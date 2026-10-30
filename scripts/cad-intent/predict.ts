import fs from "node:fs";
import { predict, type IntentModel } from "../../shared/cadIntent";

// Shows what the school model thinks of a request. Run: npx tsx scripts/cad-intent/predict.ts "коробка 80х50х30"
const model = JSON.parse(fs.readFileSync("shared/models/cad-intent.json", "utf8")) as IntentModel;
for (const text of process.argv.slice(2)) console.log(text, "→", JSON.stringify(predict(model, text)));
