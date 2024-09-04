import { Given, Then, When } from "@cucumber/cucumber";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  KeyList,
  PrivateKey, RequestType,
  TopicCreateTransaction, TopicInfo, TopicInfoQuery,
  TopicMessageQuery, TopicMessageSubmitTransaction,
  Transaction,
  TransactionReceipt
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import assert from "node:assert";
import ConsensusSubmitMessage = RequestType.ConsensusSubmitMessage;

// Pre-configured client for test network (testnet)
const client = Client.forTestnet()

const getAccountDetails = async (accountId: string, privateKey: string): Promise<{ privKey: PrivateKey; accountBalance: number; }> => {
  const account: AccountId = AccountId.fromString(accountId);
  
  const privKey: PrivateKey = PrivateKey.fromStringED25519(privateKey);
  client.setOperator(account, privKey);

  // Create the query request
  const query: AccountBalanceQuery = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client);
  return {
    privKey,
    accountBalance: balance.hbars.toBigNumber().toNumber(),
  }
}

Given(/^a first account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const { id: accountId, privateKey } = accounts[1];
  const { privKey, accountBalance } = await getAccountDetails(accountId, privateKey);
  this.firstAccPrivKey = privKey;
  assert.ok(accountBalance > expectedBalance);
});

When(/^A topic is created with the memo "([^"]*)" with the first account as the submit key$/, async function (memo: string) {
  const txResponse = await new TopicCreateTransaction()
    .setSubmitKey(this.firstAccPrivKey.publicKey)
    .setTopicMemo(memo)
    .execute(client);

  const receipt: TransactionReceipt = await txResponse.getReceipt(client);
  this.topicId = receipt.topicId;
  const topicInfo: TopicInfo = await new TopicInfoQuery().setTopicId(this.topicId).execute(client);
  assert.equal(topicInfo.topicMemo, memo);
  assert.equal(String(topicInfo.submitKey), this.firstAccPrivKey.publicKey.toString());
});

When(/^The message "([^"]*)" is published to the topic$/, async function (message: string) {
  const submitMsgTx: Transaction = await new TopicMessageSubmitTransaction({
    topicId: this.topicId,
    message,
  })
  .freezeWith(client)
  .sign(this.firstAccPrivKey)
  const submitMsgTxSubmit = await submitMsgTx.execute(client);
  const getReceipt: TransactionReceipt = await submitMsgTxSubmit.getReceipt(client);

  const submitStatus: string = getReceipt.status.toString();
  assert.equal(submitStatus, 'SUCCESS');
});

Then(/^The message "([^"]*)" is received by the topic and can be printed to the console$/, async function (message: string) {
  const recivedMessage = await new Promise((resolve, reject) => new TopicMessageQuery()
  .setTopicId(this.topicId)
  .setStartTime(0)
  .subscribe(
      client,
      (message, err) => {
        if (err) {
          return reject(err.message);
        }
      },
      (message) => resolve(Buffer.from(message.contents).toString())
  ));
  console.log(`Received message from the topic: ${recivedMessage}`);
  assert.equal(recivedMessage, message);
});

Given(/^A second account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const { id: accountId, privateKey } = accounts[3];
  const { privKey, accountBalance } = await getAccountDetails(accountId, privateKey);
  this.secondAccPrivKey = privKey;
  assert.ok(accountBalance > expectedBalance);
});

Given(/^A (\d+) of (\d+) threshold key with the first and second account$/, async function (threshold: number, size: number) {
  const publicKeyList = [this.firstAccPrivKey.publicKey, this.secondAccPrivKey.publicKey];
  const thresholdKey: KeyList =  new KeyList(publicKeyList, threshold);
  this.thresholdKey = thresholdKey;
  assert.ok(size > threshold);
  assert.equal(thresholdKey.threshold, threshold);
});

When(/^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/, async function (memo: string) {
  const txResponse = await new TopicCreateTransaction()
    .setSubmitKey(this.thresholdKey)
    .setTopicMemo(memo)
    .execute(client);

  const receipt = await txResponse.getReceipt(client);
  this.topicId = receipt.topicId;
  const topicInfo: TopicInfo = await new TopicInfoQuery().setTopicId(this.topicId).execute(client);
  assert.equal(topicInfo.topicMemo, memo);
  assert.equal(String(topicInfo.submitKey), this.thresholdKey.toString());
});
