#!/usr/bin/env node
'use strict';

/* eslint-disable no-use-before-define */

// Dependencies
var serializer = require('./serializer');
var UI = require('./ui');
var render = require('./render');

var debug = require('debug')('node-cba-netbank');
var fs = require('fs');
var moment = require('./moment');
var yargs = require('yargs');

var tagAccountName = '<name>';
var tagAccountNumber = '<number>';
var tagFrom = '<from>';
var tagTo = '<to>';
var tagExt = '<ext>';
var outputFilenameTemplate = `[${tagAccountName}](${tagAccountNumber}) [${tagFrom} to ${tagTo}].${tagExt}`;

var ui = new UI();
var myArgv = yargs.usage('CBA Netbank CLI\nUsage: $0 <command> [args]').option('u', {
  alias: 'username',
  demandOption: !process.env.NETBANK_USERNAME,
  default: process.env.NETBANK_USERNAME,
  defaultDescription: '$NETBANK_USERNAME',
  describe: 'client number',
  type: 'string'
}).option('p', {
  alias: 'password',
  demandOption: !process.env.NETBANK_PASSWORD,
  default: process.env.NETBANK_PASSWORD,
  defaultDescription: '$NETBANK_PASSWORD',
  describe: 'password',
  type: 'string'
}).command('list', 'List accounts', function () {}, function (argv) {
  debug(`Listing accounts ${JSON.stringify(argv)}...`);
  ui.logon(argv).then(function (accounts) {
    console.log(render.accounts(accounts));
  });
}).command('download', 'Download transactions history for given account', {
  a: {
    alias: 'account',
    demandOption: true,
    describe: 'account name or number',
    type: 'string'
  },
  f: {
    alias: 'from',
    default: moment().subtract(3, 'months').format(moment.formats.default),
    describe: 'history range from date',
    type: 'string'
  },
  t: {
    alias: 'to',
    default: moment().format(moment.formats.default),
    describe: 'history range to date',
    type: 'string'
  },
  o: {
    alias: 'output',
    default: outputFilenameTemplate,
    describe: 'output file name',
    type: 'string'
  },
  format: {
    default: 'json',
    describe: 'the output file format',
    type: 'string',
    choices: ['json', 'csv', 'qif', 'aus.qif', 'us.qif', 'ofx']
  }
}, function (argv) {
  debug(`Download transactions ${JSON.stringify(argv)}...`);
  ui.logon(argv).then(function (accounts) {
    //  matching accounts
    var account = accounts.find(function (a) {
      return a.name.toLowerCase().indexOf(argv.account.toLowerCase()) >= 0 || a.number.indexOf(argv.account) >= 0;
    });
    if (account) {
      debug(`${render.account(account)}`);
      ui.downloadHistory(account, argv.from, argv.to).then(function (history) {
        console.log(`Retrieved ${history.transactions.length} transactions`);
        var filename = argv.output.replace(tagAccountName, account.name).replace(tagAccountNumber, account.number).replace(tagFrom, moment(argv.from, moment.formats.default).format(moment.formats.sortable)).replace(tagTo, moment(argv.to, moment.formats.default).format(moment.formats.sortable)).replace(tagExt, argv.format);
        console.log(`filename: ${filename}`);
        var content = void 0;
        switch (argv.format) {
          default:
          case 'json':
            content = JSON.stringify(history.transactions);
            break;
          case 'csv':
            content = serializer.csv(history.transactions);
            break;
          case 'qif':
            content = serializer.qif(history.transactions);
            break;
          case 'aus.qif':
            content = serializer.qif(history.transactions, 'aus');
            break;
          case 'us.qif':
            content = serializer.qif(history.transactions, 'us');
            break;
          case 'ofx':
            content = serializer.ofx(history.transactions, account, argv.from, argv.to);
            break;
        }
        fs.writeFile(filename, content, function (error) {
          if (error) {
            throw error;
          }
        });
      });
    } else {
      console.log(`Cannot find account matching pattern '${argv.account}'`);
    }
  });
}).command('download-pending', 'Download pending transactions for given account', {
  a: {
    alias: 'account',
    demandOption: true,
    describe: 'account name or number',
    type: 'string'
  },
  o: {
    alias: 'output',
    default: outputFilenameTemplate,
    describe: 'output file name',
    type: 'string'
  },
  format: {
    default: 'json',
    describe: 'the output file format',
    type: 'string',
    choices: ['json', 'csv', 'qif', 'aus.qif', 'us.qif', 'ofx']
  }
}, function (argv) {
  debug(`Download pending transactions ${JSON.stringify(argv)}...`);
  ui.logon(argv).then(function (accounts) {
    //  matching accounts
    var account = accounts.find(function (a) {
      return a.name.toLowerCase().indexOf(argv.account.toLowerCase()) >= 0 || a.number.indexOf(argv.account) >= 0;
    });
    if (account) {
      debug(`${render.account(account)}`);
      ui.downloadHistory(account).then(function (history) {
		var pendingTransactions = history.pendings.map(function (t) {
          return Object.assign({}, t, { pending: true });
        });
		  
        console.log(`Retrieved ${pendingTransactions.length} transactions`);
        var filename = argv.output.replace(tagAccountName, account.name).replace(tagAccountNumber, account.number).replace(tagExt, argv.format);
        console.log(`filename: ${filename}`);
        var content = void 0;
        switch (argv.format) {
          default:
          case 'json':
            content = JSON.stringify(pendingTransactions);
            break;
          case 'csv':
            content = serializer.csv(pendingTransactions);
            break;
          case 'qif':
            content = serializer.qif(pendingTransactions);
            break;
          case 'aus.qif':
            content = serializer.qif(pendingTransactions, 'aus');
            break;
          case 'us.qif':
            content = serializer.qif(pendingTransactions, 'us');
            break;
          case 'ofx':
            content = serializer.ofx(pendingTransactions, account, argv.from, argv.to);
            break;
        }
        fs.writeFile(filename, content, function (error) {
          if (error) {
            throw error;
          }
        });
      });
    } else {
      console.log(`Cannot find account matching pattern '${argv.account}'`);
    }
  });
}).command('ui', 'Interactive user interface.', {
  m: {
    alias: 'months',
    default: 2,
    describe: 'how many months of history should be shown',
    type: 'number'
  }
}, function (argv) {
  debug(`UI: ${JSON.stringify(argv)}...`);
  ui.start(argv).catch(debug);
}).demandCommand(1, 'You have to tell me what to do, right?').help().argv;

debug(`argv => ${JSON.stringify(myArgv)}`);