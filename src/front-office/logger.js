const { format, createLogger, transports } = require("winston");
const { combine, timestamp, label, printf, prettyPrint } = format;
require("winston-daily-rotate-file");


//Using the printf format.
const customFormat = printf(({ level, message, label, timestamp }) => {
  return `[${timestamp}][${label}] ${level}: ${message}`;
});

//DailyRotateFile func()
const fileRotateTransportFOAccess = new transports.DailyRotateFile({
  filename: "../utils/logs/front-office/access-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

//DailyRotateFile func()
const fileRotateTransportFOError = new transports.DailyRotateFile({
  filename: "../utils/logs/front-office/error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

//DailyRotateFile func()
const fileRotateTransportBOAccess = new transports.DailyRotateFile({
  filename: "../utils/logs/back-office/access-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

//DailyRotateFile func()
const fileRotateTransportBOError = new transports.DailyRotateFile({
  filename: "../utils/logs/back-office/error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

const fo_accessLogger = createLogger({
  level: "info",
  format: combine(label({ label: 'FRONT-OFFICE' }), timestamp({ format: "DD-MM-YYYY HH:mm:ss", }), customFormat, format.colorize()),
  transports: [fileRotateTransportFOAccess, new transports.Console()],
});

const fo_errorLogger = createLogger({
  level: "error",
  format: combine(
    label({ label: 'FRONT-OFFICE' }),
    timestamp({
      format: "DD-MM-YYYY HH:mm:ss",
    }),
    prettyPrint()
  ),
  transports: [fileRotateTransportFOError, new transports.Console()],
});

const bo_accessLogger = createLogger({
  level: "info",
  format: combine(label({ label: 'BACK-OFFICE' }), timestamp({ format: "DD-MM-YYYY HH:mm:ss", }), customFormat, format.colorize()),
  transports: [fileRotateTransportBOAccess, new transports.Console()],
});

const bo_errorLogger = createLogger({
  level: "error",
  format: combine(
    label({ label: 'BACK-OFFICE' }),
    timestamp({
      format: "DD-MM-YYYY HH:mm:ss",
    }),
    prettyPrint()
  ),
  transports: [fileRotateTransportBOError, new transports.Console()],
});


module.exports = {
  fo_accessLogger,
  fo_errorLogger,
  bo_accessLogger,
  bo_errorLogger
};