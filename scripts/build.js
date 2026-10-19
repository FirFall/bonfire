// Cross-platform production build for the React client.
//
// Exists because some machines have `allow-scripts` set in their global
// ~/.npmrc (npm 11.19+ feature). `npm run` propagates that as a CLI flag to
// nested installs, where project-scoped installs reject it with EALLOWSCRIPTS.
// Clearing the variable here keeps `npm run build` working everywhere.
const path = require("path");
const { execSync } = require("child_process");

const env = { ...process.env };
delete env.npm_config_allow_scripts;
delete env.NPM_CONFIG_ALLOW_SCRIPTS;

execSync("npm install && npm run build", {
  cwd: path.join(__dirname, "..", "client"),
  stdio: "inherit",
  env,
});
