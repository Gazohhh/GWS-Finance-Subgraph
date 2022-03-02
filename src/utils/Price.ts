import { SUSHI_OHMDAI_PAIR, SUSHI_USDC_ETH_PAIR } from './Constants'
import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { UniswapV2Pair } from '../../generated/OlympusStakingV1/UniswapV2Pair';
import { toDecimal } from './Decimals'

let BIG_DECIMAL_1E12 = BigDecimal.fromString('1e12')
let BIG_DECIMAL_1E9 = BigDecimal.fromString('1e9')

export function getETHUSDRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_USDC_ETH_PAIR))
    let reserves = pair.try_getReserves()
    let rate: BigDecimal = BigDecimal.fromString("0");
    if (reserves.reverted == false) {
        let reserve0 = reserves.value.value0.toBigDecimal()
        let reserve1 = reserves.value.value1.toBigDecimal()
        let ethRate = reserve1.div(reserve0).times(BIG_DECIMAL_1E12)
        rate = ethRate;
    }
    log.warning("getETHUSDRate reverted {}", [reserves.reverted.toString()]);
    log.warning("getETHUSDRate rate {}", [rate.toString()])
    return rate;
}

export function getOHMUSDRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SUSHI_OHMDAI_PAIR))
    let reserves = pair.try_getReserves()
    let marketPrice: BigDecimal = BigDecimal.fromString("0");
    if (reserves.reverted == false) {
        let reserve0 = reserves.value.value0.toBigDecimal()
        let reserve1 = reserves.value.value1.toBigDecimal()
        let rate = reserve1.div(reserve0).div(BIG_DECIMAL_1E9);
        marketPrice = rate;
    }
    log.warning("getOHMUSDRate reverted {}", [reserves.reverted.toString()]);
    log.warning("getOHMUSDRate marketPrice {}", [marketPrice.toString()])
    return marketPrice;
}

//(slp_treasury/slp_supply)*(2*sqrt(lp_dai * lp_ohm))
export function getDiscountedPairUSD(lp_amount: BigInt, pair_adress: string): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))

    let total_lp = pair.totalSupply()
    let lp_token_1 = toDecimal(pair.getReserves().value0, 9)
    let lp_token_2 = toDecimal(pair.getReserves().value1, 18)
    let kLast = lp_token_1.times(lp_token_2).truncate(0).digits

    let part1 = toDecimal(lp_amount, 18).div(toDecimal(total_lp, 18))
    let two = BigInt.fromI32(2)

    let sqrt = kLast.sqrt();
    let part2 = toDecimal(two.times(sqrt), 0)
    let result = part1.times(part2)
    return result
}

export function getPairUSD(lp_amount: BigInt, pair_adress: string): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))
    let total_lp = pair.try_totalSupply()
    let reserves = pair.try_getReserves();
    if (reserves.reverted == false) {
        let reserve0 = reserves.value.value0;
        let reserve1 = reserves.value.value1;
        let supply = total_lp.reverted ? BigInt.fromString("0") : BigInt.fromString(total_lp.value.toString());
        let ownedLP = toDecimal(lp_amount, 18).div(toDecimal(supply, 18))
        let ohm_value = toDecimal(reserve0, 9).times(getOHMUSDRate())
        let total_lp_usd = ohm_value.plus(toDecimal(reserve1, 18))
        return ownedLP.times(total_lp_usd)
    }
    log.warning("getPairUSD reverted {}", [reserves.reverted.toString()])
    log.warning("total_lp reverted {}", [total_lp.reverted.toString()])
    return BigDecimal.fromString("0")
}