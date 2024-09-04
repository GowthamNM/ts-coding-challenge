import { AccountBalanceQuery, AccountId, Client, Hbar, PrivateKey, TokenInfoQuery, TokenCreateTransaction, TokenMintTransaction, TokenSupplyType, TokenType, TransactionReceipt, Transaction, TransactionResponse, TokenInfo, Status, AccountBalance, TokenId, TokenAssociateTransaction, TransferTransaction, AccountCreateTransaction } from "@hashgraph/sdk";
interface tokenCreateOptions {
    tokenName: string,
    tokenSymbol: string,
    decimals: number,
    treasuryAccountId: AccountId,
    initialSupply: number,
    tokenType: TokenType,
    supplyType: TokenSupplyType,
    maxSupply?: number | undefined
}

interface transferTokenOptions {
    sourAccountId: AccountId,
    destAccountId: AccountId,
    sourPrivKey?: PrivateKey | undefined,
    tokenId: TokenId,
    tokenBalance: number,
}
const getAccountBalance = async (client: Client, accountId: AccountId): Promise<AccountBalance> => {
    const query: AccountBalanceQuery = new AccountBalanceQuery().setAccountId(accountId);
    const balance: AccountBalance = await query.execute(client);
    return balance
};

const createAToken = async (client: Client, privateKey: PrivateKey, options: tokenCreateOptions): Promise<{ receipt: TransactionReceipt, supplyKey: PrivateKey }> => {
    const supplyKey = PrivateKey.generate();
    const transaction: Transaction = await new TokenCreateTransaction({ ...options, supplyKey: supplyKey.publicKey })
        .setMaxTransactionFee(new Hbar(100))
        .freezeWith(client);
    
    const signTx: Transaction = await transaction.sign(privateKey);
    const txResponse: TransactionResponse = await signTx.execute(client);
    const receipt: TransactionReceipt = await txResponse.getReceipt(client);
    return {receipt, supplyKey} ;
}

const getTokenInfo = async (client: Client, tokenId: TokenId): Promise<TokenInfo> => new TokenInfoQuery().setTokenId(tokenId).execute(client);

const mintToken = async (client: Client, tokenId: TokenId, mintAmount: number, supplyKey: PrivateKey): Promise<Status> => {
    const transaction: TokenMintTransaction = await new TokenMintTransaction()
     .setTokenId(tokenId)
     .setAmount(mintAmount)
     .setMaxTransactionFee(new Hbar(10)) //Use when HBAR is under 10 cents
     .freezeWith(client);

  const signTx: TokenMintTransaction = await transaction.sign(supplyKey); 
  const txResponse: TransactionResponse = await signTx.execute(client);
  const receipt: TransactionReceipt = await txResponse.getReceipt(client);
  const transactionStatus: Status = receipt.status;
  return transactionStatus;
}

const associateToken = async (client: Client, accountId: AccountId, tokenId: TokenId, privateKey: PrivateKey): Promise<Status> => {
    const transaction: Transaction = await new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([tokenId])
        .freezeWith(client);
    const signTx: Transaction = await transaction.sign(privateKey);
    const txResponse: TransactionResponse = await signTx.execute(client);
    const receipt: TransactionReceipt = await txResponse.getReceipt(client);
    return receipt.status
}

const transferToken = async (client: Client, {sourAccountId, destAccountId, sourPrivKey, tokenId, tokenBalance}: transferTokenOptions): Promise<Status|Transaction> => {
    const transaction: Transaction = await new TransferTransaction()
     .addTokenTransfer(tokenId, sourAccountId, -1 * tokenBalance)
     .addTokenTransfer(tokenId, destAccountId, tokenBalance);

    if (sourPrivKey !== undefined) {
        const signTx: Transaction = await (await transaction.freezeWith(client)).sign(sourPrivKey);
        const txResponse: TransactionResponse = await signTx.execute(client);
        const receipt: TransactionReceipt = await txResponse.getReceipt(client);
        return receipt.status;
    }
    return transaction;
}

const createAnAccount = async (client: Client, initialBalance: number): Promise<{accountId: AccountId | null, privateKey: PrivateKey}> => {
    const privateKey = PrivateKey.generate();

    const transaction: TransactionResponse = await new AccountCreateTransaction().setInitialBalance(initialBalance).setKey(privateKey)
        .execute(client)
    const receipt: TransactionReceipt = await transaction.getReceipt(client)
    const accountId = receipt.accountId;

    return { accountId, privateKey };
}

export {
    associateToken,
    createAToken,
    createAnAccount,
    getTokenInfo,
    getAccountBalance,
    mintToken,
    transferToken
};