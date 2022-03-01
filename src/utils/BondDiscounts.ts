import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { OHMDAIBondV1 } from '../../generated/OHMDAIBondV1/OHMDAIBondV1';
import { DAIBondV1 } from '../../generated/DAIBondV1/DAIBondV1';

import { BondDiscount, Transaction } from '../../generated/schema'
import { DAIBOND_CONTRACT, DAIBOND_CONTRACT_BLOCK, OHMDAISLPBOND_CONTRACT, OHMDAISLPBOND_CONTRACT_BLOCK } from './Constants';
import { hourFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getOHMUSDRate } from './Price';

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount {
    let hourTimestamp = hourFromTimestamp(timestamp);

    let bondDiscount = BondDiscount.load(hourTimestamp)
    if (bondDiscount == null) {
        bondDiscount = new BondDiscount(hourTimestamp)
        bondDiscount.timestamp = timestamp
        bondDiscount.dai_discount = BigDecimal.fromString("0")
        bondDiscount.ohmdai_discount = BigDecimal.fromString("0")
        bondDiscount.frax_discount = BigDecimal.fromString("0")
        bondDiscount.ohmfrax_discount = BigDecimal.fromString("0")
        bondDiscount.eth_discount = BigDecimal.fromString("0")
        bondDiscount.lusd_discount = BigDecimal.fromString("0")
        bondDiscount.ohmlusd_discount = BigDecimal.fromString("0")
        bondDiscount.save()
    }
    return bondDiscount as BondDiscount
}

export function updateBondDiscounts(transaction: Transaction): void {
    let bd = loadOrCreateBondDiscount(transaction.timestamp);
    let ohmRate = getOHMUSDRate();

    //OHMDAI
    if (transaction.blockNumber.gt(BigInt.fromString(OHMDAISLPBOND_CONTRACT_BLOCK))) {
        let bond = OHMDAIBondV1.bind(Address.fromString(OHMDAISLPBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if (price_call.reverted === false && price_call.value.gt(BigInt.fromI32(0))) {
            bd.ohmdai_discount = ohmRate.div(toDecimal(price_call.value, 18))
            bd.ohmdai_discount = bd.ohmdai_discount.minus(BigDecimal.fromString("1"))
            bd.ohmdai_discount = bd.ohmdai_discount.times(BigDecimal.fromString("100"))
            log.warning("OHMDAI Discount OHM price {}  Bond Price {}  Discount {}", [ohmRate.toString(), price_call.value.toString(), bd.ohmfrax_discount.toString()])
        }
        bd.ohmdai_discount = ohmRate.div(toDecimal(bond.bondPriceInUSD(), 18)).minus(BigDecimal.fromString("1")).times(BigDecimal.fromString("100"))
    }

    //DAI
    if (transaction.blockNumber.gt(BigInt.fromString(DAIBOND_CONTRACT_BLOCK))) {
        let bond = DAIBondV1.bind(Address.fromString(DAIBOND_CONTRACT))
        bd.dai_discount = ohmRate.div(toDecimal(bond.bondPriceInUSD(), 18)).minus(BigDecimal.fromString("1")).times(BigDecimal.fromString("100"))
    }

    bd.save()
}