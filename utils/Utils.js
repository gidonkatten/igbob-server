import { spawnSync } from "child_process"
import YAML from 'yaml'

/**
 * Convert from DateTime to Unix time
 */
 export function convertDateToUnixTime(dateTime) {
  return parseInt((new Date(dateTime).getTime() / 1000).toFixed(0));
}

/**
 * Get user id from req
 */
 export function getUserId(req) {
   return req !== undefined && req.user !== undefined ? req.user.sub : undefined;
}

/**
 * Compile PyTEAL program and return TEAL string
 */
 export function compilePyTeal(filename) {
  const pythonProcess = spawnSync('python3', [`teal/${filename}.py`]);

  if (pythonProcess.stderr) console.log(pythonProcess.stderr.toString());

  return pythonProcess.stdout.toString();
}

/**
 * Compile PyTEAL program and return TEAL string
 */
 export function compilePyTealWithParams(filename, params) {
  const pythonProcess = spawnSync(
    'python3', 
    [`teal/${filename}.py`, YAML.stringify(params)]
  );

  if (pythonProcess.stderr) console.log(pythonProcess.stderr.toString());

  return pythonProcess.stdout.toString();
}