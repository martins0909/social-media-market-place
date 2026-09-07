declare module '@capitalsage/ercaspay-nodejs' {
  export interface ErcaspayConfig {
    baseURL: string;  // Note: SDK uses baseURL (uppercase), not baseUrl
    secretKey: string;
    logger?: any;
  }

  export interface TransactionData {
    amount: string;
    paymentReference: string;
    paymentMethods: string;
    customerName: string;
    customerEmail: string;
    currency: string;
    customerPhoneNumber?: string;
    redirectUrl?: string;
    description?: string;
    feeBearer?: string;
    metadata?: Record<string, any>;
  }

  export interface ErcaspayResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string;
    responseBody?: any;
  }

  export default class Ercaspay {
    constructor(config: ErcaspayConfig);
    
    generatePaymentReferenceUuid(): string;
    initiateTransaction(data: TransactionData): Promise<ErcaspayResponse>;
    verifyTransaction(transactionRef: string): Promise<ErcaspayResponse>;
    fetchTransactionDetails(transactionRef: string): Promise<ErcaspayResponse>;
    fetchTransactionStatus(
      transactionRef: string,
      paymentReference: string,
      paymentMethod: string
    ): Promise<ErcaspayResponse>;
    cancelTransaction(transactionRef: string): Promise<ErcaspayResponse>;
    initiateBankTransfer(transactionRef: string): Promise<ErcaspayResponse>;
    initiateUssdTransaction(transactionRef: string, bankName: string): Promise<ErcaspayResponse>;
    getBankListForUssd(): Promise<ErcaspayResponse>;
    initiateCardTransaction(params: any): Promise<ErcaspayResponse>;
    submitCardOTP(transactionRef: string, paymentReference: string, otp: string): Promise<ErcaspayResponse>;
    resendCardOTP(transactionRef: string, paymentReference: string): Promise<ErcaspayResponse>;
    getCardDetails(transactionRef: string): Promise<ErcaspayResponse>;
    verifyCardTransaction(transactionRef: string): Promise<ErcaspayResponse>;
  }
}
