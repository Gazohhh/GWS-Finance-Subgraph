import { Address } from '@graphprotocol/graph-ts'
import { Stake, Unstake } from '../generated/schema'

import { StakeCall, UnstakeCall } from '../generated/GenerationalWealthSocietyStakingV1/GenerationalWealthSocietyStakingV1'
import { toDecimal } from "./utils/Decimals"
import { loadOrCreateGWSie, updateGwsieBalance } from "./utils/GWSie"
import { loadOrCreateTransaction } from "./utils/Transactions"
import { updateProtocolMetrics } from './utils/ProtocolMetrics'

export function handleStake(call: StakeCall): void {
    let gwsie = loadOrCreateGWSie(call.from as Address)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let value = toDecimal(call.inputs._amount, 9)

    let stake = new Stake(transaction.id)
    stake.transaction = transaction.id
    stake.gwsie = gwsie.id
    stake.amount = value
    stake.timestamp = transaction.timestamp;
    stake.save()

    updateGwsieBalance(gwsie, transaction)
    updateProtocolMetrics(transaction)
}

export function handleUnstake(call: UnstakeCall): void {
    let gwsie = loadOrCreateGWSie(call.from as Address)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let value = toDecimal(call.inputs._amount, 9)

    let unstake = new Unstake(transaction.id)
    unstake.transaction = transaction.id
    unstake.gwsie = gwsie.id
    unstake.amount = value
    unstake.timestamp = transaction.timestamp;
    unstake.save()

    updateGwsieBalance(gwsie, transaction)
    updateProtocolMetrics(transaction)
}