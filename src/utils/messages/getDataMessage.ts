import { IWebHookText, IWebHookButton, IWebHookStatus } from "../../interfaces";

export interface IGetDataMessage {
  phoneId: string;
  from?: string;
  text?: string;
  status?: 'read' | 'sent' | 'delivered';
  messageId?: string;
  name?: string;
}

export const getDataMessage = (data: IWebHookText.IWebHookText & IWebHookStatus.IWebHookStatus): Promise<IGetDataMessage | null> => {
  return new Promise((resolve, reject) => {
    try {
      if (data.object === process.env.META_SERVICE) {
        if (!!data.entry?.length) {
          const entry = data.entry[0];
          const statusMessage = validateStatusMessage(entry);
          if(statusMessage){
            const { status, messageId } = statusMessage;
            const change = entry.changes[0].value.metadata;
            const phoneId = change.phone_number_id;
            return resolve({ status, phoneId, messageId });
          }

          const botMessage = validateMessage(entry);
          if (botMessage) {
            return resolve(botMessage);
          }
        }
      }
      return resolve(null);
    } catch (error) {
      console.log(error);
      return reject(error);      
    }
  });
}

const validateStatusMessage = (entry: IWebHookStatus.Entry): {status: "delivered" | "sent" | "read", messageId: string } | null => {
  if(!!entry.changes?.length) {
    const change = entry.changes[0];
    if(!!change.value.statuses){
      if(!!change.value.statuses.length){
        const status = <'read' | 'delivered' | 'sent'>change.value.statuses[0].status;
        const messageId = change.value.statuses[0].id;
        if(status){
          return { status, messageId };
        }
      }  
    }
  }
  return null;
}

const validateMessage = (entry: IWebHookText.Entry) => {
  if (entry.changes?.length && entry.changes[0].value?.messages?.length) {
    if( entry.changes[0].value?.messages?.length ){
      const messageData = entry.changes[0].value;
      const phoneId = messageData.metadata.phone_number_id;
      const from = messageData.messages[0].from;
      const text = messageData.messages[0].text.body;
      const messageId = messageData.messages[0].id;  
      const name = messageData.contacts[0].profile.name;

      const botMessage: IGetDataMessage = {
        phoneId,
        from,
        text,
        messageId,
        name
      };

      return botMessage;
    }  
  }

  return null;
}
