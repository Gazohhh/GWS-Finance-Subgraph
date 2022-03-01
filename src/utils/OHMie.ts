import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { Ohmie, Transaction } from '../../generated/schema'
import { OlympusERC20 } from '../../generated/DAIBondV1/OlympusERC20'
import { sOlympusERC20 } from '../../generated/DAIBondV1/sOlympusERC20'

import { OHM_ERC20_CONTRACT, SOHM_ERC20_CONTRACT } from '../utils/Constants'
import { loadOrCreateOhmieBalance } from './OhmieBalances'
import { toDecimal } from './Decimals'
import { getOHMUSDRate } from './Price'
import { loadOrCreateContractInfo } from './ContractInfo'
import { getHolderAux } from './AuxHolder'

export function loadOrCreateOHMie(addres: Address): Ohmie {
    let ohmie = Ohmie.load(addres.toHex())
    if (ohmie == null) {
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()

        ohmie = new Ohmie(addres.toHex())
        ohmie.active = true
        ohmie.save()
    }
    return ohmie as Ohmie
}

export function updateOhmieBalance(ohmie: Ohmie, transaction: Transaction): void {
    let balance = loadOrCreateOhmieBalance(ohmie, transaction.timestamp)

    let ohm_contract = OlympusERC20.bind(Address.fromString(OHM_ERC20_CONTRACT))
    let sohm_contract = sOlympusERC20.bind(Address.fromString(SOHM_ERC20_CONTRACT))
    
    const ohmBalanceOf = ohm_contract.try_balanceOf(Address.fromString(ohmie.id));
    const ohmBalance = ohmBalanceOf.reverted ? BigInt.fromString("0") : BigInt.fromString(ohmBalanceOf.value.toString());
    log.warning("ohmBalanceOf reverted {}", [ohmBalanceOf.reverted.toString()])
    balance.ohmBalance = toDecimal(ohmBalance, 9)

    const sohmBalanceOf = sohm_contract.try_balanceOf(Address.fromString(ohmie.id));
    const sohmBalance = sohmBalanceOf.reverted ? BigInt.fromString("0") : BigInt.fromString(sohmBalanceOf.value.toString());
    log.warning("sohmBalanceOf reverted {}", [sohmBalanceOf.reverted.toString()])
    balance.sohmBalance = toDecimal(sohmBalance, 9)

    let cinfoSohmBalance_v1 = loadOrCreateContractInfo(ohmie.id + transaction.timestamp.toString() + "sStrudelERC20")
    cinfoSohmBalance_v1.name = "sohm"
    cinfoSohmBalance_v1.contract = SOHM_ERC20_CONTRACT
    cinfoSohmBalance_v1.amount = toDecimal(sohmBalance, 9)
    cinfoSohmBalance_v1.save()
    balance.stakes.push(cinfoSohmBalance_v1.id)

    if(ohmie.active && balance.ohmBalance.lt(BigDecimal.fromString("0.01")) && balance.sohmBalance.lt(BigDecimal.fromString("0.01"))){
        let holders = getHolderAux()
        holders.value = holders.value.minus(BigInt.fromI32(1))
        holders.save()
        ohmie.active = false
    }
    else if(ohmie.active==false && (balance.ohmBalance.gt(BigDecimal.fromString("0.01")) || balance.sohmBalance.gt(BigDecimal.fromString("0.01")))){
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()
        ohmie.active = true
    }
    let bonds = balance.bonds
    balance.bonds = bonds
    //Price
    let usdRate = getOHMUSDRate()
    balance.dollarBalance = balance.ohmBalance.times(usdRate).plus(balance.sohmBalance.times(usdRate)).plus(balance.bondBalance.times(usdRate))
    balance.save()

    ohmie.lastBalance = balance.id;
    ohmie.save()
}