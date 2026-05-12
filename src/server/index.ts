import amqp from "amqplib"
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/declareAndBind.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";

async function main() {
    const rabbitConnString = "amqp://guest:guest@localhost:5672";
    const conn = await amqp.connect(rabbitConnString);

    console.log("Peril game connection to RabbitMQ was successful");
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

    const channel = await conn.createConfirmChannel();
    await declareAndBind(conn, ExchangePerilTopic, GameLogSlug, GameLogSlug + ".*", SimpleQueueType.Durable)
    printServerHelp();

    let ps: PlayingState = { isPaused: false }

    while (true) {
        const words = await getInput("Enter command: ")
        if (words.length == 0) {
            continue
        }
        switch (words[0]) {
            case "pause":
                console.log("Sending a pause message...")
                ps.isPaused = true
                await publishJSON(channel, ExchangePerilDirect, PauseKey, ps);
                continue
            case "resume":
                console.log("Sending a resume message...")
                ps.isPaused = false
                await publishJSON(channel, ExchangePerilDirect, PauseKey, ps);
                continue
            case "quit":
                console.log("Exiting...")
                process.exit()
            default:
                console.log("Command is not valid. try again!")
                continue
        }
    }





}


main().catch((err) => {


    console.error("Fatal error:", err);
    process.exit(1);
});
