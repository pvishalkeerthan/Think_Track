import { spawn } from "child_process";
import path from "path";

export const predictDifficulty = async (userData) => {
  return new Promise((resolve, reject) => {
    // Resolve the correct script path dynamically
    const scriptPath = path.resolve(__dirname, "run_predictor.py");

    // Spawn the Python process
    const process = spawn("python3", [scriptPath, JSON.stringify(userData)]);

    let result = "";

    // Handle standard output (success data)
    process.stdout.on("data", (data) => {
      result += data.toString();
    });

    // Handle standard error (failures in the Python script)
    process.stderr.on("data", (data) => {});

    // Handle when the process finishes
    process.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Python process exited with code ${code}`));
      }

      try {
        const prediction = JSON.parse(result);
        resolve(prediction); // Successfully parsed prediction
      } catch (err) {
        reject(new Error("Failed to parse prediction result"));
      }
    });

    // Handle any errors in spawning the process
    process.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
};
