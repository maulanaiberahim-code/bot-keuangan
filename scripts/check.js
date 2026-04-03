const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "..");
const IGNORED_DIRS = new Set(["node_modules", ".git", "auth"]);

function collectJavaScriptFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        return [];
      }

      return collectJavaScriptFiles(absolutePath);
    }

    return entry.name.endsWith(".js") ? [absolutePath] : [];
  });
}

const files = collectJavaScriptFiles(ROOT_DIR);
const failures = [];

files.forEach((filePath) => {
  try {
    const source = fs.readFileSync(filePath, "utf8");
    new vm.Script(source, { filename: filePath });
  } catch (error) {
    failures.push({
      filePath,
      output: error.stack || error.message
    });
  }
});

if (failures.length) {
  console.error("Syntax check failed.");
  failures.forEach((failure) => {
    console.error(`\n[${failure.filePath}]`);
    console.error(failure.output);
  });
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} file(s).`);
