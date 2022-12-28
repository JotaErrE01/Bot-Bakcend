import { AxiosInstance } from "axios";
import { Mensaje } from '@prisma/client';

interface MediaObj {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
}

export const sendMedia = async (msg: Mensaje | null, mediaObj: MediaObj, phoneId: string, metaApi: AxiosInstance): Promise<Boolean> => {

  if(!msg?.mediaType) return true;

  if (msg?.mediaType === 'IMAGE') {
    mediaObj.type = 'image';
    Object.assign(mediaObj, { image: { link: msg.link } });
  }

  if (msg?.mediaType === 'DOCUMENT') {
    mediaObj.type = 'document';
    Object.assign(mediaObj, { document: { link: msg.link } });
  }

  if (msg?.mediaType === 'VIDEO') {
    mediaObj.type = 'video';
    Object.assign(mediaObj, { video: { link: msg.link } });
  }

  try {
    await metaApi.post(`/${phoneId}/messages`, mediaObj);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
