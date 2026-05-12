import type { ConfirmChannel } from "amqplib";
import type { ArmyMove, RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import { GameState, type PlayingState } from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import { AckType } from "../internal/pubsub/subscribe.js";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
    return (ps: PlayingState): AckType => {
        handlePause(gs, ps)
        process.stdout.write("> ")
        return AckType.Ack
    }
}

export function handlerMove(gs: GameState, chan: ConfirmChannel): (move: ArmyMove) => AckType {
    return (move: ArmyMove) => {
        console.log("Move processed successfully")
        try {
            const outcome = handleMove(gs, move)
            if (outcome == MoveOutcome.Safe) {
                return AckType.Ack
            }
            if (outcome == MoveOutcome.MakeWar) {
                const rw: RecognitionOfWar = {
                    attacker: move.player,
                    defender: gs.getPlayerSnap(),
                };
                publishJSON(
                    chan,
                    ExchangePerilTopic,
                    WarRecognitionsPrefix + `.${move.player.username}`,
                    rw
                )
                return AckType.Ack
            }
        } catch (err) {
            console.log(err)
            return AckType.NackRequeue
        }
        finally {
            process.stdout.write("> ")
        }
        return AckType.Ack
    }
}

export function handlerWar(gs: GameState): (rw: RecognitionOfWar) => Promise<AckType> {
    return async (rw: RecognitionOfWar): Promise<AckType> => {
        try {
            const wr = handleWar(gs, rw)
            switch (wr.result) {
                case WarOutcome.NotInvolved:
                    return AckType.NackRequeue
                case WarOutcome.NoUnits:
                    return AckType.NackDiscard
                case WarOutcome.OpponentWon:
                    
                case WarOutcome.Draw:
                case WarOutcome.YouWon:
                    return AckType.Ack
                default:
                    console.error("Outcome is not valid")
                    return AckType.NackDiscard
            }
        } finally {
            process.stdout.write("> ")
        }
    }
}