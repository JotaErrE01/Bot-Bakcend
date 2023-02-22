import { IWebHookText, IWebHookStatus } from "../../interfaces";
import { MediaType } from '../../interfaces/IWebHookText';

export interface IGetDataMessage {
  phoneId: string;
  from?: string;
  text?: string;
  mediaData?: MediaType;
  status?: 'read' | 'sent' | 'delivered';
  messageId?: string;
  name?: string;
  waId?: string;
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
      return reject(null);      
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
      const type = messageData.messages[0].type;
      const from = messageData.messages[0].from;
      const messageId = messageData.messages[0].id;  
      const name = messageData.contacts[0].profile.name;
      const waId = messageData.contacts[0].wa_id;
      let text = undefined;
      let mediaData: MediaType | undefined = undefined;
      if(type === 'text'){
        text = messageData.messages[0].text!.body;
      } else if(type === 'image'){
        const imageData = messageData.messages[0].image!;
        mediaData = {
          id: imageData.id,
          mime_type: imageData.mime_type,
          sha256: imageData.sha256,
          caption: imageData.caption,
        }
      }else if(type === 'video'){
        const videoData = messageData.messages[0].video!;
        mediaData = {
          id: videoData.id,
          mime_type: videoData.mime_type,
          sha256: videoData.sha256,
          caption: videoData.caption,
        }
      } else if(type === 'audio'){
        const audioData = messageData.messages[0].audio!;
        mediaData = {
          id: audioData.id,
          mime_type: audioData.mime_type,
          sha256: audioData.sha256,
          caption: audioData.caption,
          voice: audioData.voice,
        }
      }else{
        const documentData = messageData.messages[0].document!;
        mediaData = {
          filename: documentData.filename,
          mime_type: documentData.mime_type,
          sha256: documentData.sha256,
          id: documentData.id,
          caption: documentData.caption,
        }
      }

      const botMessage: IGetDataMessage = {
        phoneId,
        from,
        text,
        mediaData,
        messageId,
        name,
        waId,
      };

      return botMessage;
    }  
  }

  return null;
}
