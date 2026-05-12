import amqp from "amqplib"
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";

async function main() {
    const rabbitConnString = "amqp://guest:guest@localhost:5672";
    const conn = await amqp.connect(rabbitConnString);

    console.log("Peril game connection to RabbitMQ was successful");

    const channel = await conn.createConfirmChannel();
    const playingState: PlayingState = {isPaused: true}
    await publishJSON(channel, ExchangePerilDirect, PauseKey, playingState );

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

}


main().catch((err) => {


    console.error("Fatal error:", err);
    process.exit(1);
});
