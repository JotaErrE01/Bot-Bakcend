import { AxiosInstance } from "axios";
import { Mensaje } from '@prisma/client';
import FormData from "form-data";
import axios from 'axios';

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
    //TODO: Change this to a real image
    // Object.assign(mediaObj, { image: { link: `${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}` } });
    Object.assign(mediaObj, { image: { link: 'https://wallpapercave.com/wp/wp4923991.png' } });

    // FROM META MEDIAID
    // const file = await fetch(`${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}`).then(res => res.blob());

    // const file = await axios.get(`${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}`, { responseType: 'blob' });

    // transform the blob into a buffer
    // const buffer = Buffer.from(file.data, 'binary');

    // transform application/octet-stream into image/jpeg
    // const imageType = file.headers['content-type'];
    // const formData = new FormData();
    // formData.append('file', buffer, msg.id.toString());
    // formData.append('filetype', imageType);
    // formData.append('type', 'image/png');
    // formData.append('messaging_product', 'whatsapp');
    // const { data } = await metaApi.post(`/${phoneId}/media`, formData);
    // console.log('🌌🌌🌌🌌🌌🌌🌌🌌');
    // console.log({data});
    
  }

  if (msg?.mediaType === 'DOCUMENT') {
    mediaObj.type = 'document';
    Object.assign(mediaObj, { document: { link: `${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}` } });
  }

  if (msg?.mediaType === 'VIDEO') {
    mediaObj.type = 'video';
    Object.assign(mediaObj, { video: { link: `${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}` } });
  }

  try {
    // console.log({mediaObj});
    await metaApi.post(`/${phoneId}/messages`, mediaObj);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
