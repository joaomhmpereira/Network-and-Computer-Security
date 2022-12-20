const { format, createLogger, transports } = require("winston");
const { combine, timestamp, label, printf, prettyPrint } = format;
require("winston-daily-rotate-file");

//Label
const CATEGORY = "Log Rotation";

//Using the printf format.
const customFormat = printf(({ level, message, label, timestamp }) => {
  return `<-- ${timestamp} [${label}] ${level}: ${message} -->`;
});

//DailyRotateFile func()
const fileRotateTransportAccess = new transports.DailyRotateFile({
  filename: "logs/access-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

//DailyRotateFile func()
const fileRotateTransportError = new transports.DailyRotateFile({
  filename: "logs/error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

const accessLogger = createLogger({
  level: "info",
  format: combine(label({ label: CATEGORY }), timestamp({ format: "DD-MM-YYYY HH:mm:ss", }), customFormat, format.colorize()),
  transports: [fileRotateTransportAccess, new transports.Console()],
});

const errorLogger = createLogger({
  level: "error",
  format: combine(
    label({ label: CATEGORY }),
    timestamp({
      format: "DD-MM-YYYY HH:mm:ss",
    }),
    prettyPrint()
  ),
  transports: [fileRotateTransportError, new transports.Console()],
});


module.exports = {
  accessLogger,
  errorLogger
};