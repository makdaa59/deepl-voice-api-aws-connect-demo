import { 
  CloudWatchLogsClient, 
  CreateLogStreamCommand, 
  PutLogEventsCommand 
} from "@aws-sdk/client-cloudwatch-logs";
import { getValidAwsCredentials } from "./authUtility";
import { LOGGER_PREFIX } from "../constants";

let client = null;
let currentLogStreamName = null;
const LOG_GROUP_NAME = window.WebappConfig.logGroupName;
const REGION = window.WebappConfig.logRegion;
const _originalConsole = {
//   log: console.log.bind(console), // intentially not sending standard console.log() to CloudWatch
  info: console.info.bind(console),
  debug: console.debug.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

async function getClient() {
  if (!client) {
    const credentials = await getValidAwsCredentials();
    client = new CloudWatchLogsClient({ 
      region: REGION, 
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        expiration: new Date(credentials.expiration),
      }
    });
  }
  return client;
}

async function _sendLog(level, message, data = {}) {
  if (!currentLogStreamName) return;

  const logEntry = {
    level,
    message,
    ...(Object.keys(data).length > 0 ? data : {}),
  };

  try {
    const cwClient = await getClient();
    await cwClient.send(new PutLogEventsCommand({
      logGroupName: LOG_GROUP_NAME,
      logStreamName: currentLogStreamName,
      logEvents: [{
        timestamp: Date.now(),
        message: JSON.stringify(logEntry),
      }],
    }));
  } catch (error) {
    client = null;
    _originalConsole.warn(`${LOGGER_PREFIX} - cwLogger - Error writing log:`, error);
  }
}

export async function initLogStream(contactId) {
  currentLogStreamName = contactId;

  try {
    const cwClient = await getClient();
    await cwClient.send(new CreateLogStreamCommand({
      logGroupName: LOG_GROUP_NAME,
      logStreamName: currentLogStreamName,
    }));
    overrideConsole();
    _originalConsole.info(`${LOGGER_PREFIX} - cwLogger - Log stream created: ${currentLogStreamName}`);
  } catch (error) {
      if (error.name === "ResourceAlreadyExistsException") {
        _originalConsole.info(`${LOGGER_PREFIX} - cwLogger - Log stream already exists, reusing: ${currentLogStreamName}`);
      } else {
        _originalConsole.error(`${LOGGER_PREFIX} - cwLogger - Error creating log stream:`, error);
      }
    }
}

export function overrideConsole() {
    const methods = ['info', 'warn', 'error', 'debug'];
    methods.forEach((method) => {
        console[method] = (...args) => {
            _originalConsole[method](...args);
            
            const objects = args.filter(a => typeof a === 'object');
            const strings = args.filter(a => typeof a !== 'object').map(String);
            logCW(
                method,
                strings.join(' '),
                objects.length > 0 ? { data: objects.length === 1 ? objects[0] : objects } : {}
            );
        };
    });
}

function restoreConsoleLogs() {
  Object.keys(_originalConsole).forEach((method) => {
    console[method] = _originalConsole[method];
  });
}

export async function logCW(level, message, data) {
  _sendLog(level, message, data).catch((error) => {
    _originalConsole.error(`${LOGGER_PREFIX} - cwLogger - Unhandled log error:`, error);
  });
}

// Call on contact end to flush anything remaining
export function resetLogStream() {
  restoreConsoleLogs();
  currentLogStreamName = null;
  client = null;
}