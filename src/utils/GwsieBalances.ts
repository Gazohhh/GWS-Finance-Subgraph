import { BigDecimal, BigInt, Address} from '@graphprotocol/graph-ts'
import { Gwsie, GwsieBalance } from '../../generated/schema'
import { dayFromTimestamp } from './Dates';

export function loadOrCreateGwsieBalance(gwsie: Gwsie, timestamp: BigInt): GwsieBalance{
    let id = timestamp.toString()+gwsie.id

    let gwsieBalance = GwsieBalance.load(id)
    if (gwsieBalance == null) {
        gwsieBalance = new GwsieBalance(id)
        gwsieBalance.gwsie = gwsie.id
        gwsieBalance.timestamp = timestamp
        gwsieBalance.sgwsBalance = BigDecimal.fromString("0")
        gwsieBalance.gwsBalance = BigDecimal.fromString("0")
        gwsieBalance.bondBalance = BigDecimal.fromString("0")
        gwsieBalance.dollarBalance = BigDecimal.fromString("0")
        gwsieBalance.stakes = []
        gwsieBalance.bonds = []
        gwsieBalance.save()
    }
    return gwsieBalance as GwsieBalance
}

