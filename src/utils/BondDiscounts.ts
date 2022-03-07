import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { GWSDAIBondV1 } from '../../generated/GWSDAIBondV1/GWSDAIBondV1';
import { DAIBondV1 } from '../../generated/DAIBondV1/DAIBondV1';

import { BondDiscount, Transaction } from '../../generated/schema'
import { DAIBOND_CONTRACT, DAIBOND_CONTRACT_BLOCK, GWSDAISLPBOND_CONTRACT, GWSDAISLPBOND_CONTRACT_BLOCK } from './Constants';
import { hourFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getGWSUSDRate } from './Price';

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount {
    let hourTimestamp = hourFromTimestamp(timestamp);

    let bondDiscount = BondDiscount.load(hourTimestamp)
    if (bondDiscount == null) {
        bondDiscount = new BondDiscount(hourTimestamp)
        bondDiscount.timestamp = timestamp
        bondDiscount.dai_discount = BigDecimal.fromString("0")
        bondDiscount.gwsdai_discount = BigDecimal.fromString("0")
        bondDiscount.frax_discount = BigDecimal.fromString("0")
        bondDiscount.gwsfrax_discount = BigDecimal.fromString("0")
        bondDiscount.eth_discount = BigDecimal.fromString("0")
        bondDiscount.lusd_discount = BigDecimal.fromString("0")
        bondDiscount.gwslusd_discount = BigDecimal.fromString("0")
        bondDiscount.save()
    }
    return bondDiscount as BondDiscount
}

export function updateBondDiscounts(transaction: Transaction): void {
    let bd = loadOrCreateBondDiscount(transaction.timestamp);
    let gwsRate = getGWSUSDRate();

    //GWSDAI
    if (transaction.blockNumber.gt(BigInt.fromString(GWSDAISLPBOND_CONTRACT_BLOCK))) {
        let bond = GWSDAIBondV1.bind(Address.fromString(GWSDAISLPBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if (price_call.reverted === false && price_call.value.gt(BigInt.fromI32(0))) {
            bd.gwsdai_discount = gwsRate.div(toDecimal(price_call.value, 18))
            bd.gwsdai_discount = bd.gwsdai_discount.minus(BigDecimal.fromString("1"))
            bd.gwsdai_discount = bd.gwsdai_discount.times(BigDecimal.fromString("100"))
            log.warning("GWSDAI Discount GWS price {}  Bond Price {}  Discount {}", [gwsRate.toString(), price_call.value.toString(), bd.gwsfrax_discount.toString()])
        }
        bd.gwsdai_discount = gwsRate.div(toDecimal(price_call.value, 18)).minus(BigDecimal.fromString("1")).times(BigDecimal.fromString("100"))
    }

    //DAI
    if (transaction.blockNumber.gt(BigInt.fromString(DAIBOND_CONTRACT_BLOCK))) {
        let bond = DAIBondV1.bind(Address.fromString(DAIBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if (price_call.reverted === false && price_call.value.gt(BigInt.fromI32(0))) {
            bd.dai_discount = gwsRate.div(toDecimal(price_call.value, 18)).minus(BigDecimal.fromString("1")).times(BigDecimal.fromString("100"))
        }
    }

    bd.save()
}