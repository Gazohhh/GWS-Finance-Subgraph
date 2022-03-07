import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { Gwsie, Transaction } from '../../generated/schema'
import { GenerationalWealthSocietyERC20 } from '../../generated/DAIBondV1/GenerationalWealthSocietyERC20'
import { sGenerationalWealthSocietyERC20 } from '../../generated/DAIBondV1/sGenerationalWealthSocietyERC20'

import { GWS_ERC20_CONTRACT, SGWS_ERC20_CONTRACT } from '../utils/Constants'
import { loadOrCreateGwsieBalance } from './GwsieBalances'
import { toDecimal } from './Decimals'
import { getGWSUSDRate } from './Price'
import { loadOrCreateContractInfo } from './ContractInfo'
import { getHolderAux } from './AuxHolder'

export function loadOrCreateGWSie(addres: Address): Gwsie {
    let gwsie = Gwsie.load(addres.toHex())
    if (gwsie == null) {
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()

        gwsie = new Gwsie(addres.toHex())
        gwsie.active = true
        gwsie.save()
    }
    return gwsie as Gwsie
}

export function updateGwsieBalance(gwsie: Gwsie, transaction: Transaction): void {
    let balance = loadOrCreateGwsieBalance(gwsie, transaction.timestamp)

    let gws_contract = GenerationalWealthSocietyERC20.bind(Address.fromString(GWS_ERC20_CONTRACT))
    let sgws_contract = sGenerationalWealthSocietyERC20.bind(Address.fromString(SGWS_ERC20_CONTRACT))
    
    const gwsBalanceOf = gws_contract.try_balanceOf(Address.fromString(gwsie.id));
    const gwsBalance = gwsBalanceOf.reverted ? BigInt.fromString("0") : BigInt.fromString(gwsBalanceOf.value.toString());
    log.warning("gwsBalanceOf reverted {}", [gwsBalanceOf.reverted.toString()])
    balance.gwsBalance = toDecimal(gwsBalance, 9)

    const sgwsBalanceOf = sgws_contract.try_balanceOf(Address.fromString(gwsie.id));
    const sgwsBalance = sgwsBalanceOf.reverted ? BigInt.fromString("0") : BigInt.fromString(sgwsBalanceOf.value.toString());
    log.warning("sgwsBalanceOf reverted {}", [sgwsBalanceOf.reverted.toString()])
    balance.sgwsBalance = toDecimal(sgwsBalance, 9)

    let cinfoSgwsBalance_v1 = loadOrCreateContractInfo(gwsie.id + transaction.timestamp.toString() + "sStrudelERC20")
    cinfoSgwsBalance_v1.name = "sgws"
    cinfoSgwsBalance_v1.contract = SGWS_ERC20_CONTRACT
    cinfoSgwsBalance_v1.amount = toDecimal(sgwsBalance, 9)
    cinfoSgwsBalance_v1.save()
    balance.stakes.push(cinfoSgwsBalance_v1.id)

    if(gwsie.active && balance.gwsBalance.lt(BigDecimal.fromString("0.01")) && balance.sgwsBalance.lt(BigDecimal.fromString("0.01"))){
        let holders = getHolderAux()
        holders.value = holders.value.minus(BigInt.fromI32(1))
        holders.save()
        gwsie.active = false
    }
    else if(gwsie.active==false && (balance.gwsBalance.gt(BigDecimal.fromString("0.01")) || balance.sgwsBalance.gt(BigDecimal.fromString("0.01")))){
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()
        gwsie.active = true
    }
    let bonds = balance.bonds
    balance.bonds = bonds
    //Price
    let usdRate = getGWSUSDRate()
    balance.dollarBalance = balance.gwsBalance.times(usdRate).plus(balance.sgwsBalance.times(usdRate)).plus(balance.bondBalance.times(usdRate))
    balance.save()

    gwsie.lastBalance = balance.id;
    gwsie.save()
}