import { Given, Then, When, setDefaultTimeout } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { AccountId, Client, PrivateKey, TokenSupplyType, TokenType, Transaction, TokenInfo, Status, AccountBalance, TransactionId, TransferTransaction, TransactionReceipt, TransactionResponse } from "@hashgraph/sdk";
import assert from "node:assert";

import {
  associateToken,
  createAToken,
  createAnAccount,
  getTokenInfo,
  getAccountBalance,
  mintToken,
  transferToken,
} from '../../src/helper/token';

const client = Client.forTestnet()

setDefaultTimeout(120000)

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const { id: accountId, privateKey } = accounts[0];
  const MY_ACCOUNT_ID = AccountId.fromString(accountId);
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(privateKey);
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

  const balance: AccountBalance = await getAccountBalance(client, MY_ACCOUNT_ID);
  this.accountId = accountId;
  this.privateKey = MY_PRIVATE_KEY;
  this.myAccountId = MY_ACCOUNT_ID;
  this.myPrivateKey = MY_PRIVATE_KEY;
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)

});

When(/^I create a token named Test Token \(HTT\)$/, async function () {

  const { receipt, supplyKey } = await createAToken(client, this.myPrivateKey, {
    tokenName: "Test Token",
    tokenSymbol: "HTT",
    decimals: 2,
    treasuryAccountId: this.myAccountId,
    initialSupply: 0,
    tokenType: TokenType.FungibleCommon,
    supplyType: TokenSupplyType.Infinite,
  })
  this.supplyKey = supplyKey;
  const submitStatus: Status = receipt.status;
  this.tokenId = receipt.tokenId;
  assert.equal(submitStatus.toString(), 'SUCCESS');
});

Then(/^The token has the name "([^"]*)"$/, async function (name: string) {
  const tokenInfo: TokenInfo = await getTokenInfo(client, this.tokenId);
  this.tokenInfo = tokenInfo;
  assert.equal(name, tokenInfo.name);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (symbol: string) {
  assert.equal(symbol, this.tokenInfo.symbol);
});

Then(/^The token has (\d+) decimals$/, async function (decimals: number) {
  assert.equal(+decimals, +this.tokenInfo.decimals);
});

Then(/^The token is owned by the account$/, async function () {
  assert.equal(this.accountId, this.tokenInfo.treasuryAccountId);
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function (mint: number) {
  const transactionStatus: Status = await mintToken(client, this.tokenId, mint, this.supplyKey)

  assert.equal(transactionStatus.toString(), 'SUCCESS');
});
When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function (numTokens: number) {

  const { receipt, supplyKey } = await createAToken(client, this.myPrivateKey, {
    tokenName: "Test Token",
    tokenSymbol: "HTT",
    decimals: 2,
    treasuryAccountId: this.myAccountId,
    initialSupply: numTokens,
    tokenType: TokenType.FungibleCommon,
    supplyType: TokenSupplyType.Finite,
    maxSupply: numTokens
  });
  this.supplyKey = supplyKey;
  this.tokenId = receipt.tokenId;
  const transactionStatus: Status = receipt.status;
  assert.equal(transactionStatus.toString(), 'SUCCESS');
});
Then(/^The total supply of the token is (\d+)$/, async function (totalSupply: number) {
  const tokenInfo = await getTokenInfo(client, this.tokenId);
  assert.equal(totalSupply, +tokenInfo.totalSupply);
});
Then(/^An attempt to mint tokens fails$/, async function () {
  try {
    const transactionStatus: Status = await mintToken(client, this.tokenId, 2, PrivateKey.generate())
    assert.equal(transactionStatus.toString(), 'SUCCESS');
  } catch (err: any) {
    assert.equal(String(err.status), 'INVALID_SIGNATURE');
  }
});
Given(/^A first hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const { id: accountId, privateKey } = accounts[2];
  this.firstAccId = AccountId.fromString(accountId);
  this.firstPrivKey = PrivateKey.fromStringED25519(privateKey);

  const balance: AccountBalance = await getAccountBalance(client, this.firstAccId);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
});
Given(/^A second Hedera account$/, async function () {
  const { id: accountId, privateKey } = accounts[3];
  this.secondAccId = AccountId.fromString(accountId);
  this.secondPrivKey = PrivateKey.fromStringED25519(privateKey);
});
Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (numTokens: number) {
  const { id: accountId, privateKey } = accounts[0];
  this.treasuryAccountId = AccountId.fromString(accountId);
  this.treasuryPrivKey = PrivateKey.fromStringED25519(privateKey);
  client.setOperator(this.treasuryAccountId, this.treasuryPrivKey);
  const { receipt, supplyKey } = await createAToken(client, this.treasuryPrivKey, {
    tokenName: "Test Token",
    tokenSymbol: "HTT",
    decimals: 2,
    treasuryAccountId: this.treasuryAccountId,
    initialSupply: numTokens,
    tokenType: TokenType.FungibleCommon,
    supplyType: TokenSupplyType.Finite,
    maxSupply: numTokens
  });
  this.supplyKey = supplyKey;
  this.tokenId = receipt.tokenId;
  const transactionStatus: Status = receipt.status;
  assert.equal(transactionStatus.toString(), 'SUCCESS');
});
Given(/^The first account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  try {
    const firstAccAssociateStatus: Status = await associateToken(client, this.firstAccId, this.tokenId, this.firstPrivKey);
    const transactionStatus: Status | Transaction = await transferToken(client, {
      sourAccountId: this.treasuryAccountId,
      destAccountId: this.firstAccId,
      sourPrivKey: this.treasuryPrivKey,
      tokenId: this.tokenId,
      tokenBalance
    });
    assert.equal(firstAccAssociateStatus.toString(), 'SUCCESS');
    assert.equal(transactionStatus.toString(), 'SUCCESS');
  } catch (err) { }
  const balance: AccountBalance = await getAccountBalance(client, this.firstAccId);
  assert.equal(balance.tokens?.get(this.tokenId).toNumber(), tokenBalance);

});
Given(/^The second account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  try {
    const secondAccAssociateStatus: Status = await associateToken(client, this.secondAccId, this.tokenId, this.secondPrivKey);
    const transactionStatus: Status | Transaction = await transferToken(client, {
      sourAccountId: this.treasuryAccountId,
      destAccountId: this.secondAccId,
      sourPrivKey: this.treasuryPrivKey,
      tokenId: this.tokenId,
      tokenBalance
    });
    assert.equal(secondAccAssociateStatus.toString(), 'SUCCESS');
    assert.equal(transactionStatus.toString(), 'SUCCESS');
  } catch (err) { }

  const balance: AccountBalance = await getAccountBalance(client, this.secondAccId);
  assert.equal(balance.tokens?.get(this.tokenId).toNumber(), tokenBalance);

});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (amount: number) {
  const newClient = Client.forTestnet().setOperator(this.firstAccId, this.firstPrivKey);
  const transaction: any = await transferToken(newClient, {
    sourAccountId: this.firstAccId,
    destAccountId: this.secondAccId,
    tokenId: this.tokenId,
    tokenBalance: amount,
  });
  this.tokenTransferTransaction = transaction.freezeWith(newClient);
  console.log('Token transfer transaction from first account to second account created');
});
When(/^The first account submits the transaction$/, async function () {
  const newClient = Client.forTestnet().setOperator(this.firstAccId, this.firstPrivKey);
  this.balanceBeforeTx = await getAccountBalance(newClient, this.firstAccId);

  const signTx = await this.tokenTransferTransaction.sign(this.firstPrivKey);
  const transferRx: TransactionResponse = await signTx.execute(newClient);
  const receipt: TransactionReceipt = await transferRx.getReceipt(newClient);
  console.log(`Token transfer transaction status: ${receipt.status}`);

  this.balanceAfterTx = await getAccountBalance(newClient, this.firstAccId);
  const transactionStatus: Status = receipt.status;
  assert.equal(transactionStatus.toString(), 'SUCCESS');
});
When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (amount: number) {
  const newClient = Client.forTestnet().setOperator(this.secondAccId, this.secondPrivKey);

  this.transferTransaction = await transferToken(newClient, {
    sourAccountId: this.secondAccId,
    destAccountId: this.firstAccId,
    tokenId: this.tokenId,
    tokenBalance: amount,
  });
  const signTx: Transaction = await this.transferTransaction.setTransactionId(TransactionId.generate(this.firstAccId)).freezeWith(newClient);
  this.tokenTransferTransaction = signTx;
  console.log(`Token transfer transaction from second account to first account created`);
});
Then(/^The first account has paid for the transaction fee$/, async function () {
  assert.ok(this.balanceBeforeTx > this.balanceAfterTx);
});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function (expectedBalance: number, tokenBalance: number) {
  const { id: accountId, privateKey } = accounts[2];
  this.firstAccId = AccountId.fromString(accountId);
  this.firstPrivKey = PrivateKey.fromStringED25519(privateKey);
  try {
    const firstAccBalance: AccountBalance = await getAccountBalance(client, this.firstAccId);

    const assocStatus: Status = await associateToken(client, this.firstAccId, this.tokenId, this.firstPrivKey)

    const tokenTransferStatus: Status | Transaction = await transferToken(client, {
      sourAccountId: this.treasuryAccountId,
      destAccountId: this.firstAccId,
      sourPrivKey: this.treasuryPrivKey,
      tokenId: this.tokenId,
      tokenBalance
    });
    assert.ok(firstAccBalance.hbars.toBigNumber().toNumber() > expectedBalance);
    assert.equal(assocStatus.toString(), 'SUCCESS');
    assert.equal(tokenTransferStatus.toString(), 'SUCCESS');
  } catch (err) { }

  const firstAccBalance: AccountBalance = await getAccountBalance(client, this.firstAccId);
  assert.equal(firstAccBalance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (accountBalance: number, tokenBalance: number) {
  const { accountId, privateKey } = await createAnAccount(client, accountBalance);
  this.secondAccId = accountId;
  this.secondPrivKey = privateKey;
  try {
    const secondAccBalance: AccountBalance = await getAccountBalance(client, this.secondAccId);

    const assocStatus: Status = await associateToken(client, this.secondAccId, this.tokenId, this.secondPrivKey)

    const tokenTransferStatus: Status | Transaction = await transferToken(client, {
      sourAccountId: this.treasuryAccountId,
      destAccountId: this.secondAccId,
      tokenId: this.tokenId,
      sourPrivKey: this.treasuryPrivKey,
      tokenBalance
    });
    assert.equal(secondAccBalance.hbars.toBigNumber().toNumber(), accountBalance);
    assert.equal(assocStatus.toString(), 'SUCCESS');
    assert.equal(tokenTransferStatus.toString(), 'SUCCESS');
  } catch (err) { }

  const secondAccBalance: AccountBalance = await getAccountBalance(client, this.secondAccId);
  assert.equal(secondAccBalance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (accountBalance: number, tokenBalance: number) {
  const { accountId, privateKey } = await createAnAccount(client, accountBalance);
  this.thirdAccId = accountId;
  this.thirdPrivKey = privateKey;
  try {
    const thirdAccBalance: AccountBalance = await getAccountBalance(client, this.thirdAccId);

    const assocStatus: Status = await associateToken(client, this.thirdAccId, this.tokenId, this.thirdPrivKey)

    const tokenTransferStatus: Status | Transaction = await transferToken(client, {
      sourAccountId: this.treasuryAccountId,
      destAccountId: this.thirdAccId,
      tokenId: this.tokenId,
      sourPrivKey: this.treasuryPrivKey,
      tokenBalance
    });
    assert.equal(thirdAccBalance.hbars.toBigNumber().toNumber(), accountBalance);
    assert.equal(assocStatus.toString(), 'SUCCESS');
    assert.equal(tokenTransferStatus.toString(), 'SUCCESS');
  } catch (err) { }

  const thirdAccBalance: AccountBalance = await getAccountBalance(client, this.thirdAccId);
  assert.equal(thirdAccBalance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (accountBalance: number, tokenBalance: number) {
  const { accountId, privateKey } = await createAnAccount(client, accountBalance);
  this.fourthAccId = accountId;
  this.fourthPrivKey = privateKey;
  try {
    const fourthAccBalance: AccountBalance = await getAccountBalance(client, this.fourthAccId);

    const assocStatus: Status = await associateToken(client, this.fourthAccId, this.tokenId, this.fourthPrivKey)

    const tokenTransferStatus: Status | Transaction = await transferToken(client, {
      sourAccountId: this.treasuryAccountId,
      destAccountId: this.fourthAccId,
      tokenId: this.tokenId,
      sourPrivKey: this.treasuryPrivKey,
      tokenBalance
    });
    assert.equal(fourthAccBalance.hbars.toBigNumber().toNumber(), accountBalance);
    assert.equal(assocStatus.toString(), 'SUCCESS');
    assert.equal(tokenTransferStatus.toString(), 'SUCCESS');
  } catch (err) { }

  const fourthAccBalance: AccountBalance = await getAccountBalance(client, this.fourthAccId);
  assert.equal(fourthAccBalance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function (tr1, tr3, tr4) {
  const newClient = Client.forTestnet().setOperator(this.secondAccId, this.secondPrivKey);
  this.tokenTransferTransaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.firstAccId, -1 * tr1)
    .addTokenTransfer(this.tokenId, this.secondAccId, -1 * tr1)
    .addTokenTransfer(this.tokenId, this.thirdAccId, tr3)
    .addTokenTransfer(this.tokenId, this.fourthAccId, tr4)
    .setTransactionId(TransactionId.generate(this.firstAccId))
    .freezeWith(newClient)
    .sign(this.secondPrivKey);
});
Then(/^The third account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  const thirdAccBalance: AccountBalance = await getAccountBalance(client, this.thirdAccId);
  assert.equal(thirdAccBalance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  const fourthAccBalance: AccountBalance = await getAccountBalance(client, this.fourthAccId);
  assert.equal(fourthAccBalance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
});
