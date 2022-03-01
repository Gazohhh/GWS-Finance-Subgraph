import { BigInt } from '@graphprotocol/graph-ts';
import { HolderAux } from '../../generated/schema'

export const HOLDER_AuxHolder = '0';
 
export function getHolderAux(): HolderAux{
    let holders = HolderAux.load(HOLDER_AuxHolder)
    if (holders == null) {
        holders = new HolderAux(HOLDER_AuxHolder)
        holders.value = new BigInt(0)
    }
    return holders as HolderAux
}