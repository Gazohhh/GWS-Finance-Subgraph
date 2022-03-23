import { DepositCall, RedeemCall } from '../generated/GWSDAIBondV1/GWSDAIBondV1'
import { Deposit, Redemption } from '../generated/schema'
import { loadOrCreateTransaction } from "./utils/Transactions"
import { loadOrCreateGWSie, updateGwsieBalance } from "./utils/GWSie"
import { toDecimal } from "./utils/Decimals"
import { GWSDAILPBOND_TOKEN, SUSHI_GWSDAI_PAIR } from './utils/Constants'
import { loadOrCreateToken } from './utils/Tokens'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { createDailyBondRecord } from './utils/DailyBond'
import { getPairUSD } from './utils/Price'

export function handleDeposit(call: DepositCall): void {
  let gwsie = loadOrCreateGWSie(call.transaction.from)
  let transaction = loadOrCreateTransaction(call.transaction, call.block)
  let token = loadOrCreateToken(GWSDAILPBOND_TOKEN)

  let amount = toDecimal(call.inputs._amount, 18)
  let deposit = new Deposit(transaction.id)
  deposit.transaction = transaction.id
  deposit.gwsie = gwsie.id
  deposit.amount = amount
  deposit.value = getPairUSD(call.inputs._amount, SUSHI_GWSDAI_PAIR)
  deposit.maxPremium = new BigDecimal(new BigInt(0))
  deposit.token = token.id;
  deposit.timestamp = transaction.timestamp;
  deposit.save()

  createDailyBondRecord(deposit.timestamp, token, deposit.amount, deposit.value)
  updateGwsieBalance(gwsie, transaction)
}

export function handleRedeem(call: RedeemCall): void {
  let gwsie = loadOrCreateGWSie(call.transaction.from)
  let transaction = loadOrCreateTransaction(call.transaction, call.block)

  let redemption = Redemption.load(transaction.id)
  if (redemption == null) {
    redemption = new Redemption(transaction.id)
  }
  redemption.transaction = transaction.id
  redemption.gwsie = gwsie.id
  redemption.token = loadOrCreateToken(GWSDAILPBOND_TOKEN).id;
  redemption.timestamp = transaction.timestamp;
  redemption.save()
  updateGwsieBalance(gwsie, transaction)
}