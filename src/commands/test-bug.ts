import { Command } from "commander";
import * as fs from "fs";

export function testBugCommand(program: Command): Command {
  return program
    .command("test-bug")
    .description("Intentionally buggy command for testing PR checks")
    .option(
      "-u, --url <url>",
      "API URL to call",
      "https://api.example.com/data"
    )
    .action(async (options) => {
      console.log("Running buggy test... this is expected to fail in CI");

      // BUG 1: Unhandled promise rejection with bad fetch (missing await and missing error handling)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fetch(options.url, { method: "POST", body: JSON.stringify({ a: 1 }) });

      // BUG 2: Intentional infinite timeout to simulate hanging process
      setTimeout(
        () => {
          console.log("This should never print");
        },
        60 * 60 * 1000
      );

      // BUG 3: Sync crash after writing partial file
      fs.writeFileSync("./buggy-output.tmp", "partial data...");
      // @ts-expect-error intentional runtime error
      const x: any = undefined;
      console.log(x.toLowerCase());
    });
}
