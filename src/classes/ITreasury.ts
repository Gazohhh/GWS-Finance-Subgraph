import { BigDecimal } from "@graphprotocol/graph-ts";

export class ITreasury {
    treasuryMarketValue: BigDecimal;
    treasuryRiskFreeValue: BigDecimal;
    treasuryDaiRiskFreeValue: BigDecimal;
    treasuryUsdcRiskFreeValue: BigDecimal;
    treasuryDaiMarketValue: BigDecimal;
    treasuryUsdcMarketValue: BigDecimal;
    treasuryGwsDaiPOL: BigDecimal;
}