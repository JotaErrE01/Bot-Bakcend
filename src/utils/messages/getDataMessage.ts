import { IWebHookText, IWebHookButton, IWebHookStatus } from "../../interfaces";

interface IGetDataMessage {
  phoneId: string;
  recipentWaId: string;
  text?: string;
}

export const getDataMessage = (data: IWebHookText.IWebHookText & IWebHookStatus.IWebHookStatus): Promise<IGetDataMessage | null | "delivered" | "read" | "sent"> => {
  return new Promise((resolve, reject) => {
    try {
      if (data.object === process.env.META_SERVICE) {
        if (!!data.entry?.length) {
          const entry = data.entry[0];
          const status = validateStatusMessage(entry);
          if (status) {
            return resolve(status);
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

const validateStatusMessage = (entry: IWebHookStatus.Entry): "delivered" | "sent" | "read" | null => {
  if(!!entry.changes?.length) {
    const change = entry.changes[0];
    if(!!change.value.statuses){
      if(!!change.value.statuses.length){
        const status = change.value.statuses[0].status;
        if(status === "delivered"){
          return "delivered";
        }
        if(status === "read"){
          return "read";
        }
        if(status === "sent"){
          return "sent";
        }
      }  
    }
  }
  return null;
}

const validateMessage = (entry: IWebHookText.Entry) => {
  if (entry.changes?.length && entry.changes[0].value?.messages?.length) {
    if( entry.changes[0].value?.messages?.length ){
      const phoneId = entry.changes[0].value.metadata.phone_number_id;
      const recipentWaId = entry.changes[0].value?.messages[0].from;
      const text = entry.changes[0].value?.messages[0].text.body;

      const botMessage: IGetDataMessage = {
        phoneId,
        recipentWaId,
        text
      };

      return botMessage;
    }  
  }

  return null;
}
