import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { GenerationalWealthSocietyERC20 } from '../../generated/GenerationalWealthSocietyStakingV1/GenerationalWealthSocietyERC20';
import { sGenerationalWealthSocietyERC20 } from '../../generated/GenerationalWealthSocietyStakingV1/sGenerationalWealthSocietyERC20';
import { CirculatingSupply } from '../../generated/GenerationalWealthSocietyStakingV1/CirculatingSupply';
import { ERC20 } from '../../generated/GenerationalWealthSocietyStakingV1/ERC20';
import { UniswapV2Pair } from '../../generated/GenerationalWealthSocietyStakingV1/UniswapV2Pair';
import { GenerationalWealthSocietyStakingV1 } from '../../generated/GenerationalWealthSocietyStakingV1/GenerationalWealthSocietyStakingV1';

import { ProtocolMetric, Transaction } from '../../generated/schema'
import { CIRCULATING_SUPPLY_CONTRACT, DAI_ERC20_CONTRACT, GWSDAISLPBOND_CONTRACT_BLOCK, GWS_ERC20_CONTRACT, SGWS_ERC20_CONTRACT, STAKING_CONTRACT, SUSHI_GWSDAI_PAIR, TREASURY_ADDRESS } from './Constants';
import { dayFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getGWSUSDRate, getDiscountedPairUSD, getPairUSD } from './Price';
import { getHolderAux } from './AuxHolder';
import { updateBondDiscounts } from './BondDiscounts';
import { ITreasury } from '../classes/ITreasury';

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
    let dayTimestamp = dayFromTimestamp(timestamp);

    let protocolMetric = ProtocolMetric.load(dayTimestamp)
    if (protocolMetric == null) {
        protocolMetric = new ProtocolMetric(dayTimestamp)
        protocolMetric.timestamp = timestamp
        protocolMetric.gwsCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.sGwsCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.totalSupply = BigDecimal.fromString("0")
        protocolMetric.gwsPrice = BigDecimal.fromString("0")
        protocolMetric.marketCap = BigDecimal.fromString("0")
        protocolMetric.totalValueLocked = BigDecimal.fromString("0")
        protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryMarketValue = BigDecimal.fromString("0")
        protocolMetric.nextEpochRebase = BigDecimal.fromString("0")
        protocolMetric.nextDistributedGws = BigDecimal.fromString("0")
        protocolMetric.currentAPY = BigDecimal.fromString("0")
        protocolMetric.treasuryDaiRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryDaiMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryGwsDaiPOL = BigDecimal.fromString("0")
        protocolMetric.treasuryGwsLusdPOL = BigDecimal.fromString("0")
        protocolMetric.treasuryGwsEthPOL = BigDecimal.fromString("0")
        protocolMetric.holders = BigInt.fromI32(0)

        protocolMetric.save()
    }
    return protocolMetric as ProtocolMetric
}


function getTotalSupply(): BigDecimal {
    const gws_contract = GenerationalWealthSocietyERC20.bind(Address.fromString(GWS_ERC20_CONTRACT))
    const trySupply = gws_contract.try_totalSupply();
    const supply = trySupply.reverted ? BigInt.fromString("0") : trySupply.value;
    const total_supply = toDecimal(supply, 9)
    log.warning("Total Supply {}", [total_supply.toString()])
    return total_supply
}

function getCirculatingSupply(total_supply: BigDecimal): BigDecimal {
    let circ_supply = BigDecimal.fromString("0")
    let circulatingsupply_contract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
    circ_supply = toDecimal(circulatingsupply_contract.GWSCirculatingSupply(), 9)

    log.warning("Circulating Supply {}", [total_supply.toString()])
    return circ_supply
}

function getSGWSSupply(): BigDecimal {
    let sgws_supply = BigDecimal.fromString("0")

    let sgws_contract_v1 = sGenerationalWealthSocietyERC20.bind(Address.fromString(SGWS_ERC20_CONTRACT))
    sgws_supply = toDecimal(sgws_contract_v1.circulatingSupply(), 9)

    log.warning("sGWS Supply {}", [sgws_supply.toString()])
    return sgws_supply
}

function getMV_RFV(transaction: Transaction): ITreasury {
    let daiERC20 = ERC20.bind(Address.fromString(DAI_ERC20_CONTRACT))
    let gwsdaiPair = UniswapV2Pair.bind(Address.fromString(SUSHI_GWSDAI_PAIR))
    let treasury_address = TREASURY_ADDRESS;

    // DAI
    let daiTryBalance = daiERC20.try_balanceOf(Address.fromString(treasury_address))
    let daiBalance = daiTryBalance.reverted ? BigInt.fromString("0") : daiTryBalance.value;
    log.warning("daiBalance Value {}", [daiBalance.toString()])

    // GWS-DAI
    let gwsdai_value = BigDecimal.fromString("0");
    let gwsdai_rfv = BigDecimal.fromString("0");
    let gwsdaiPOL = BigDecimal.fromString("0");
    if (transaction.blockNumber.gt(BigInt.fromString(GWSDAISLPBOND_CONTRACT_BLOCK))) {
        let gwsdaiTryUniBalance = gwsdaiPair.try_balanceOf(Address.fromString(treasury_address))
        let gwsdaiUniBalance = gwsdaiTryUniBalance.reverted ? BigInt.fromString("0") : gwsdaiTryUniBalance.value;
        let gwsdaiBalance = gwsdaiUniBalance;
        let gwsdaiPairTrySupply = gwsdaiPair.try_totalSupply()
        let gwsdaiPairSupply = gwsdaiPairTrySupply.reverted ? BigInt.fromString("0") : gwsdaiPairTrySupply.value;
        log.warning("toDecimal(gwsdaiBalance, 18) {}", [toDecimal(gwsdaiBalance, 18).toString()])
        log.warning("toDecimal(gwsdaiPairSupply, 18) {}", [toDecimal(gwsdaiPairSupply, 18).toString()])
        gwsdaiPOL = toDecimal(gwsdaiBalance, 18).div(toDecimal(gwsdaiPairSupply, 18)).times(BigDecimal.fromString("100"))
        log.warning("gwsdaiPOL {}", [gwsdaiPOL.toString()])
        gwsdai_value = getPairUSD(gwsdaiBalance, SUSHI_GWSDAI_PAIR)
        gwsdai_rfv = getDiscountedPairUSD(gwsdaiBalance, SUSHI_GWSDAI_PAIR)
    }

    let stableValue = daiBalance
    let stableValueDecimal = toDecimal(stableValue, 18)
    let lpValue = gwsdai_value;
    let rfvLpValue = gwsdai_rfv
    let treasuryMarketValue = stableValueDecimal.plus(lpValue);
    let treasuryRiskFreeValue = stableValueDecimal.plus(rfvLpValue)

    log.warning("Treasury Market Value {}", [treasuryMarketValue.toString()])
    log.warning("Treasury RFV {}", [treasuryRiskFreeValue.toString()])
    log.warning("Treasury DAI value {}", [toDecimal(daiBalance, 18).toString()])
    log.warning("Treasury GWS-DAI RFV {}", [gwsdai_rfv.toString()])

    return {
        treasuryMarketValue, // TMV
        treasuryRiskFreeValue, // TRF
        treasuryDaiRiskFreeValue: gwsdai_rfv.plus(toDecimal(daiBalance, 18)),
        treasuryDaiMarketValue: gwsdai_value.plus(toDecimal(daiBalance, 18)),
        treasuryGwsDaiPOL: gwsdaiPOL // POL
    }
}

function getNextGWSRebase(): BigDecimal {
    let next_distribution = BigDecimal.fromString("0")
    const stakingContract = GenerationalWealthSocietyStakingV1.bind(Address.fromString(STAKING_CONTRACT))
    let distribution = toDecimal(stakingContract.epoch().value3, 9)
    log.warning("next_distribution v1 {}", [distribution.toString()])
    return next_distribution.plus(distribution);
}

function getAPY_Rebase(sGWSCirculatingSupply: BigDecimal, nextDistributedGWS: BigDecimal): BigDecimal[] {
    const stakingContract = GenerationalWealthSocietyStakingV1.bind(Address.fromString(STAKING_CONTRACT))
    const tryDistribute = stakingContract.try_epoch();
    const stakingReward = tryDistribute.reverted ? Number.parseFloat("0") : Number.parseFloat(tryDistribute.value.value3.toString());
    const sorkanContract = sGenerationalWealthSocietyERC20.bind(Address.fromString(SGWS_ERC20_CONTRACT));
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
    if (nextDistributedGWS.gt(BigDecimal.fromString("0")) && sGWSCirculatingSupply.gt(BigDecimal.fromString("0"))) {
        nextEpochRebase = nextDistributedGWS.div(sGWSCirculatingSupply).times(BigDecimal.fromString("100"));
    }

    return [BigDecimal.fromString(trimmedCurrentAPY.toString()), nextEpochRebase]
}

function getRunway(sGWS: BigDecimal, rfv: BigDecimal, rebase: BigDecimal): BigDecimal[] {
    let runway2dot5k = BigDecimal.fromString("0")
    let runway5k = BigDecimal.fromString("0")
    let runway7dot5k = BigDecimal.fromString("0")
    let runway10k = BigDecimal.fromString("0")
    let runway20k = BigDecimal.fromString("0")
    let runway50k = BigDecimal.fromString("0")
    let runway70k = BigDecimal.fromString("0")
    let runway100k = BigDecimal.fromString("0")
    let runwayCurrent = BigDecimal.fromString("0")

    if (sGWS.gt(BigDecimal.fromString("0")) && rfv.gt(BigDecimal.fromString("0")) && rebase.gt(BigDecimal.fromString("0"))) {
        let treasury_runway = Number.parseFloat(rfv.div(sGWS).toString())

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
    pm.gwsCirculatingSupply = getCirculatingSupply(pm.totalSupply)

    //sGws Supply
    pm.sGwsCirculatingSupply = getSGWSSupply()

    //GWS Price
    pm.gwsPrice = getGWSUSDRate()

    //GWS Market Cap
    pm.marketCap = pm.gwsCirculatingSupply.times(pm.gwsPrice)

    //Total Value Locked
    pm.totalValueLocked = pm.sGwsCirculatingSupply.times(pm.gwsPrice)

    // //Treasury RFV and MV
    let mv_rfv = getMV_RFV(transaction)
    pm.treasuryMarketValue = mv_rfv.treasuryMarketValue;
    pm.treasuryRiskFreeValue = mv_rfv.treasuryRiskFreeValue;
    pm.treasuryDaiRiskFreeValue = mv_rfv.treasuryDaiRiskFreeValue;
    pm.treasuryDaiMarketValue = mv_rfv.treasuryDaiMarketValue;
    pm.treasuryGwsDaiPOL = mv_rfv.treasuryGwsDaiPOL

    // Rebase rewards, APY, rebase
    pm.nextDistributedGws = getNextGWSRebase()
    let apy_rebase = getAPY_Rebase(pm.sGwsCirculatingSupply, pm.nextDistributedGws)
    pm.currentAPY = apy_rebase[0]
    pm.nextEpochRebase = apy_rebase[1]

    //Runway
    let runways = getRunway(pm.sGwsCirculatingSupply, pm.treasuryRiskFreeValue, pm.nextEpochRebase)
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