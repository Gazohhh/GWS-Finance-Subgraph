import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { OlympusERC20 } from '../../generated/OlympusStakingV1/OlympusERC20';
import { sOlympusERC20 } from '../../generated/OlympusStakingV1/sOlympusERC20';
import { CirculatingSupply } from '../../generated/OlympusStakingV1/CirculatingSupply';
import { ERC20 } from '../../generated/OlympusStakingV1/ERC20';
import { UniswapV2Pair } from '../../generated/OlympusStakingV1/UniswapV2Pair';
import { OlympusStakingV1 } from '../../generated/OlympusStakingV1/OlympusStakingV1';

import { ProtocolMetric, Transaction } from '../../generated/schema'
import { CIRCULATING_SUPPLY_CONTRACT, ERC20DAI_CONTRACT, OHMDAISLPBOND_CONTRACT_BLOCK, OHM_ERC20_CONTRACT, SOHM_ERC20_CONTRACT, STAKING_CONTRACT, SUSHI_OHMDAI_PAIR, TREASURY_ADDRESS } from './Constants';
import { dayFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getOHMUSDRate, getDiscountedPairUSD, getPairUSD } from './Price';
import { getHolderAux } from './AuxHolder';
import { updateBondDiscounts } from './BondDiscounts';
import { ITreasury } from '../classes/ITreasury';

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
    let dayTimestamp = dayFromTimestamp(timestamp);

    let protocolMetric = ProtocolMetric.load(dayTimestamp)
    if (protocolMetric == null) {
        protocolMetric = new ProtocolMetric(dayTimestamp)
        protocolMetric.timestamp = timestamp
        protocolMetric.ohmCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.sOhmCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.totalSupply = BigDecimal.fromString("0")
        protocolMetric.ohmPrice = BigDecimal.fromString("0")
        protocolMetric.marketCap = BigDecimal.fromString("0")
        protocolMetric.totalValueLocked = BigDecimal.fromString("0")
        protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryMarketValue = BigDecimal.fromString("0")
        protocolMetric.nextEpochRebase = BigDecimal.fromString("0")
        protocolMetric.nextDistributedOhm = BigDecimal.fromString("0")
        protocolMetric.currentAPY = BigDecimal.fromString("0")
        protocolMetric.treasuryDaiRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryFraxRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryLusdRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryDaiMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryFraxMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryLusdMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryXsushiMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryWETHRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryWETHMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryCVXMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryOhmDaiPOL = BigDecimal.fromString("0")
        protocolMetric.treasuryOhmFraxPOL = BigDecimal.fromString("0")
        protocolMetric.treasuryOhmLusdPOL = BigDecimal.fromString("0")
        protocolMetric.treasuryOhmEthPOL = BigDecimal.fromString("0")
        protocolMetric.holders = BigInt.fromI32(0)

        protocolMetric.save()
    }
    return protocolMetric as ProtocolMetric
}


function getTotalSupply(): BigDecimal {
    const ohm_contract = OlympusERC20.bind(Address.fromString(OHM_ERC20_CONTRACT))
    const trySupply = ohm_contract.try_totalSupply();
    const supply = trySupply.reverted ? BigInt.fromString("0") : trySupply.value;
    const total_supply = toDecimal(supply, 9)
    log.warning("Total Supply {}", [total_supply.toString()])
    return total_supply
}

function getCirculatingSupply(total_supply: BigDecimal): BigDecimal {
    let circ_supply = BigDecimal.fromString("0")
    let circulatingsupply_contract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
    circ_supply = toDecimal(circulatingsupply_contract.OHMCirculatingSupply(), 9)

    log.warning("Circulating Supply {}", [total_supply.toString()])
    return circ_supply
}

function getSOHMSupply(): BigDecimal {
    let sohm_supply = BigDecimal.fromString("0")

    let sohm_contract_v1 = sOlympusERC20.bind(Address.fromString(SOHM_ERC20_CONTRACT))
    sohm_supply = toDecimal(sohm_contract_v1.circulatingSupply(), 9)

    log.warning("sOHM Supply {}", [sohm_supply.toString()])
    return sohm_supply
}

function getMV_RFV(transaction: Transaction): ITreasury {
    let daiERC20 = ERC20.bind(Address.fromString(ERC20DAI_CONTRACT))
    let ohmdaiPair = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMDAI_PAIR))
    let treasury_address = TREASURY_ADDRESS;

    // DAI
    let daiTryBalance = daiERC20.try_balanceOf(Address.fromString(treasury_address))
    let daiBalance = daiTryBalance.reverted ? BigInt.fromString("0") : daiTryBalance.value;
    log.warning("daiBalance Value {}", [daiBalance.toString()])

    // OHM-DAI
    let ohmdai_value = BigDecimal.fromString("0");
    let ohmdai_rfv = BigDecimal.fromString("0");
    let ohmdaiPOL = BigDecimal.fromString("0");
    if (transaction.blockNumber.gt(BigInt.fromString(OHMDAISLPBOND_CONTRACT_BLOCK))) {
        let ohmdaiSushiTryBalance = ohmdaiPair.try_balanceOf(Address.fromString(treasury_address))
        let ohmdaiSushiBalance = ohmdaiSushiTryBalance.reverted ? BigInt.fromString("0") : ohmdaiSushiTryBalance.value;
        let ohmdaiBalance = ohmdaiSushiBalance;
        let ohmdaiPairTrySupply = ohmdaiPair.try_totalSupply()
        let ohmdaiPairSupply = ohmdaiPairTrySupply.reverted ? BigInt.fromString("0") : ohmdaiPairTrySupply.value;
        let ohmdaiTotalLP = toDecimal(ohmdaiPairSupply, 18)
        ohmdaiPOL = toDecimal(ohmdaiBalance, 18).div(ohmdaiTotalLP).times(BigDecimal.fromString("100"))
        ohmdai_value = getPairUSD(ohmdaiBalance, SUSHI_OHMDAI_PAIR)
        ohmdai_rfv = getDiscountedPairUSD(ohmdaiBalance, SUSHI_OHMDAI_PAIR)
    }

    // let stableValue = daiBalance.plus(fraxBalance).plus(adaiBalance).plus(lusdBalance)
    // let lpValue = ohmdai_value.plus(ohmfrax_value).plus(ohmlusd_value).plus(ohmeth_value);
    // let rfvLpValue = ohmdai_rfv.plus(ohmfrax_rfv).plus(ohmlusd_rfv).plus(ohmeth_rfv)
    // let treasuryMarketValue = stableValueDecimal.plus(lpValue).plus(xSushi_value).plus(weth_value)
    let stableValue = daiBalance;
    let stableValueDecimal = toDecimal(stableValue, 18)
    let lpValue = ohmdai_value;
    let rfvLpValue = ohmdai_rfv
    let treasuryMarketValue = stableValueDecimal.plus(lpValue);
    let treasuryRiskFreeValue = stableValueDecimal.plus(rfvLpValue)

    log.warning("Treasury Market Value {}", [treasuryMarketValue.toString()])
    log.warning("Treasury RFV {}", [treasuryRiskFreeValue.toString()])
    log.warning("Treasury DAI value {}", [toDecimal(daiBalance, 18).toString()])
    log.warning("Treasury OHM-DAI RFV {}", [ohmdai_rfv.toString()])

    return {
        treasuryMarketValue, // TMV
        treasuryRiskFreeValue, // TRF
        treasuryDaiRiskFreeValue: ohmdai_rfv.plus(toDecimal(daiBalance, 18)), // treasuryDaiRiskFreeValue = DAI RFV * DAI + aDAI
        treasuryDaiMarketValue: ohmdai_value.plus(toDecimal(daiBalance, 18)), // treasuryDaiMarketValue = DAI LP * DAI + aDAI
        treasuryOhmDaiPOL: ohmdaiPOL // POL
    }
}

function getNextOHMRebase(): BigDecimal {
    let next_distribution = BigDecimal.fromString("0")
    const stakingContract = OlympusStakingV1.bind(Address.fromString(STAKING_CONTRACT))
    let distribution = toDecimal(stakingContract.epoch().value3, 9)
    log.warning("next_distribution v1 {}", [distribution.toString()])
    return next_distribution.plus(distribution);
}

function getAPY_Rebase(sOHMCirculatingSupply: BigDecimal, nextDistributedOHM: BigDecimal): BigDecimal[] {
    const stakingContract = OlympusStakingV1.bind(Address.fromString(STAKING_CONTRACT))
    const tryDistribute = stakingContract.try_epoch();
    const stakingReward = tryDistribute.reverted ? Number.parseFloat("0") : Number.parseFloat(tryDistribute.value.value3.toString());

    const sorkanContract = sOlympusERC20.bind(Address.fromString(SOHM_ERC20_CONTRACT));
    const tryCirculatingSupply = sorkanContract.try_circulatingSupply();
    const circulatingSupply = tryCirculatingSupply.reverted ? Number.parseFloat("0") : Number.parseFloat(tryCirculatingSupply.value.toString());

    // isFinite() returns false if a value is Infinity, -Infinity, or NaN, otherwise true.
    const stakingRebase = !isFinite(Number.parseFloat(stakingReward.toString()) / Number.parseFloat(circulatingSupply.toString()))
        ? Number.parseFloat("0")
        : (Number.parseFloat(stakingReward.toString()) / Number.parseFloat(circulatingSupply.toString()));

    // isFinite() returns false if a value is Infinity, -Infinity, or NaN, otherwise true.
    const currentAPY = !isFinite(Math.pow(1 + stakingRebase, 365 * 3) - 1) ? Number.parseFloat("0") : Math.pow(1 + stakingRebase, 365 * 3) - 1;
    const trimmedCurrentAPY = currentAPY * 100;

    let nextEpochRebase = BigDecimal.fromString("0");
    // Next epoch rebase can only be determined when the values are higher than 0.
    if (nextDistributedOHM.gt(BigDecimal.fromString("0")) && sOHMCirculatingSupply.gt(BigDecimal.fromString("0"))) {
        nextEpochRebase = nextDistributedOHM.div(sOHMCirculatingSupply).times(BigDecimal.fromString("100"));
    }

    return [BigDecimal.fromString(trimmedCurrentAPY.toString()), nextEpochRebase]
}

function getRunway(sOHM: BigDecimal, rfv: BigDecimal, rebase: BigDecimal): BigDecimal[] {
    let runway2dot5k = BigDecimal.fromString("0")
    let runway5k = BigDecimal.fromString("0")
    let runway7dot5k = BigDecimal.fromString("0")
    let runway10k = BigDecimal.fromString("0")
    let runway20k = BigDecimal.fromString("0")
    let runway50k = BigDecimal.fromString("0")
    let runway70k = BigDecimal.fromString("0")
    let runway100k = BigDecimal.fromString("0")
    let runwayCurrent = BigDecimal.fromString("0")

    if (sOHM.gt(BigDecimal.fromString("0")) && rfv.gt(BigDecimal.fromString("0")) && rebase.gt(BigDecimal.fromString("0"))) {
        let treasury_runway = Number.parseFloat(rfv.div(sOHM).toString())

        let runway2dot5k_num = (Math.log(treasury_runway) / Math.log(1 + 0.0029438)) / 3;
        let runway5k_num = (Math.log(treasury_runway) / Math.log(1 + 0.003579)) / 3;
        let runway7dot5k_num = (Math.log(treasury_runway) / Math.log(1 + 0.0039507)) / 3;
        let runway10k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00421449)) / 3;
        let runway20k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00485037)) / 3;
        let runway50k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00569158)) / 3;
        let runway70k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00600065)) / 3;
        let runway100k_num = (Math.log(treasury_runway) / Math.log(1 + 0.00632839)) / 3;
        let nextEpochRebase_number = Number.parseFloat(rebase.toString()) / 100
        let runwayCurrent_num = (Math.log(treasury_runway) / Math.log(1 + nextEpochRebase_number)) / 3;

        runway2dot5k = BigDecimal.fromString(runway2dot5k_num.toString())
        runway5k = BigDecimal.fromString(runway5k_num.toString())
        runway7dot5k = BigDecimal.fromString(runway7dot5k_num.toString())
        runway10k = BigDecimal.fromString(runway10k_num.toString())
        runway20k = BigDecimal.fromString(runway20k_num.toString())
        runway50k = BigDecimal.fromString(runway50k_num.toString())
        runway70k = BigDecimal.fromString(runway70k_num.toString())
        runway100k = BigDecimal.fromString(runway100k_num.toString())
        runwayCurrent = BigDecimal.fromString(runwayCurrent_num.toString())
    }

    return [runway2dot5k, runway5k, runway7dot5k, runway10k, runway20k, runway50k, runway70k, runway100k, runwayCurrent]
}


export function updateProtocolMetrics(transaction: Transaction): void {
    let pm = loadOrCreateProtocolMetric(transaction.timestamp);

    //Total Supply
    pm.totalSupply = getTotalSupply()

    //Circ Supply
    pm.ohmCirculatingSupply = getCirculatingSupply(pm.totalSupply)

    //sOhm Supply
    pm.sOhmCirculatingSupply = getSOHMSupply()

    //OHM Price
    pm.ohmPrice = getOHMUSDRate()

    //OHM Market Cap
    pm.marketCap = pm.ohmCirculatingSupply.times(pm.ohmPrice)

    //Total Value Locked
    pm.totalValueLocked = pm.sOhmCirculatingSupply.times(pm.ohmPrice)

    // //Treasury RFV and MV
    let mv_rfv = getMV_RFV(transaction)
    pm.treasuryMarketValue = mv_rfv.treasuryMarketValue;
    pm.treasuryRiskFreeValue = mv_rfv.treasuryRiskFreeValue;
    pm.treasuryDaiRiskFreeValue = mv_rfv.treasuryDaiRiskFreeValue;
    pm.treasuryDaiMarketValue = mv_rfv.treasuryDaiMarketValue;
    pm.treasuryOhmDaiPOL = mv_rfv.treasuryOhmDaiPOL

    // Rebase rewards, APY, rebase
    pm.nextDistributedOhm = getNextOHMRebase()
    log.warning("pm.nextDistributedOhm {}", [pm.nextDistributedOhm.toString()])
    let apy_rebase = getAPY_Rebase(pm.sOhmCirculatingSupply, pm.nextDistributedOhm)
    pm.currentAPY = apy_rebase[0]
    log.warning("pm.currentAPY {}", [pm.currentAPY.toString()])
    pm.nextEpochRebase = apy_rebase[1]
    log.warning("pm.nextEpochRebase {}", [pm.nextEpochRebase.toString()])

    //Runway
    let runways = getRunway(pm.sOhmCirculatingSupply, pm.treasuryRiskFreeValue, pm.nextEpochRebase)
    pm.runway2dot5k = runways[0]
    pm.runway5k = runways[1]
    pm.runway7dot5k = runways[2]
    pm.runway10k = runways[3]
    pm.runway20k = runways[4]
    pm.runway50k = runways[5]
    pm.runway70k = runways[6]
    pm.runway100k = runways[7]
    pm.runwayCurrent = runways[8]

    //Holders
    pm.holders = getHolderAux().value

    pm.save()

    updateBondDiscounts(transaction)
}