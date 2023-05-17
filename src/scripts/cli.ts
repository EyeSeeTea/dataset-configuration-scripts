import path from "path";
import { run, subcommands } from "cmd-ts";
import { fixSectionsDatasetsCommand } from "./migrate-datasets-sections-codes";

export function runCli() {
    const cliSubcommands = subcommands({
        name: path.basename(__filename),
        cmds: {
            "fix-sections-nrc-datasets": fixSectionsDatasetsCommand,
        },
    });

    const args = process.argv.slice(2);
    run(cliSubcommands, args);
}
