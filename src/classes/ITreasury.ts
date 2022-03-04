import { BigDecimal } from "@graphprotocol/graph-ts";

export class ITreasury {
    treasuryMarketValue: BigDecimal;
    treasuryRiskFreeValue: BigDecimal;
    treasuryDaiRiskFreeValue: BigDecimal;
    treasuryDaiMarketValue: BigDecimal;
    treasuryUsdcMarketValue: BigDecimal;
    treasuryOhmDaiPOL: BigDecimal;
}