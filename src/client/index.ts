import amqp from "amqplib"
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/declareAndBind.js";
import { ArmyMovesPrefix, ExchangePerilDirect, ExchangePerilTopic, PauseKey, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove, handleMove } from "../internal/gamelogic/move.js";
import { subscribeJSON } from "../internal/pubsub/subscribe.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";
import { publishJSON } from "../internal/pubsub/publish.js";

async function main() {
    console.log("Starting Peril client...");
    const rabbitConnString = "amqp://guest:guest@localhost:5672";
    const conn = await amqp.connect(rabbitConnString);
    console.log("Connection to rabbitqm was successful");

    ["SIGINT", "SIGTERM"].forEach((signal) => {
        process.on(signal, async () => {
            try {
                await conn.close()
                console.log("RabbitMQ connection closed.")
            } catch (err) {
                console.error("Error closing RabbitMQ connection: ", err)
            } finally {
                process.exit()
            }
        })
    })

    const username = await clientWelcome();

    await declareAndBind(
        conn,
        ExchangePerilDirect,
        PauseKey + `.${username}`,
        PauseKey,
        SimpleQueueType.Transient
    );

    const gameState = new GameState(username)
    const chan = await conn.createConfirmChannel()

    await subscribeJSON(
        conn,
        ExchangePerilDirect,
        PauseKey + `.${username}`,
        PauseKey,
        SimpleQueueType.Transient,
        handlerPause(gameState)
    )

    await subscribeJSON(
        conn,
        ExchangePerilTopic,
        ArmyMovesPrefix + `.${username}`,
        ArmyMovesPrefix + `.*`,
        SimpleQueueType.Transient,
        handlerMove(gameState, chan)
    )

    await subscribeJSON(
        conn,
        ExchangePerilTopic,
        WarRecognitionsPrefix + `.${username}`,
        WarRecognitionsPrefix + ".#",
        SimpleQueueType.Durable,
        handlerWar(gameState)
    )

    while (true) {
        const words = await getInput("Enter command: ")
        if (words.length == 0) {
            continue
        }
        try {
            switch (words[0]) {
                case "spawn":
                    commandSpawn(gameState, words)
                    continue
                case "move":
                    const move = commandMove(gameState, words)
                    await publishJSON(chan, ExchangePerilTopic, ArmyMovesPrefix + `.${username}`, move)
                    continue
                case "status":
                    commandStatus(gameState)
                    continue
                case "help":
                    printClientHelp()
                    continue
                case "spam":
                    console.log("Spamming not allowed yet")
                    continue
                case "quit":
                    printQuit()
                    process.exit()
                default:
                    console.error("Command is not valid. try again!")
                    continue
            }
        } catch (error: any) {
            console.error(error.message)
            continue
        }
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
