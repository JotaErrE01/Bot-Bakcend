import { AxiosInstance } from "axios";
import { App, Cliente, Mensaje } from '@prisma/client';
import { prisma } from '../db/config';
import { Messages } from '.';

export const sendMedia = async (msg: Mensaje | null, phoneId: string, metaApi: AxiosInstance, from: string, aplication: App, client:  Cliente, dataMsg: Messages.IGetDataMessage): Promise<Boolean> => {
  let mediaObj = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": `${from}`,
    "type": ""
  };
  if (msg?.mediaType === 'IMAGE') {
    mediaObj.type = 'image';
    //TODO: Change this to a real image
    // Object.assign(mediaObj, { image: { link: `${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}` } });
    Object.assign(mediaObj, { image: { link: 'https://wallpapercave.com/wp/wp4923991.png', caption: msg?.cuerpo } });
  }

  if (msg?.mediaType === 'DOCUMENT') {
    mediaObj.type = 'document';
    Object.assign(mediaObj, { document: { link: `${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}`, caption: msg?.cuerpo } });
  }

  if (msg?.mediaType === 'VIDEO') {
    mediaObj.type = 'video';
    Object.assign(mediaObj, { video: { link: `${process.env.ADMIN_BOT_HOST}/api/static?id=${msg.id}`, caption: msg?.cuerpo } });
  }

  try {
    
    const { generalMessage, conversacion } = prisma;
    const conversation = await conversacion.findUnique({
      where: {
        id: msg?.conversacionId
      },
      include: {
        empresa: true,
      }
    });

    await generalMessage.create({
      data: {
        appID: aplication.id,
        empresaId: aplication.empresaId,
        idOrigen: client.id,
        origen: 'CLIENTE',
        mensaje: dataMsg.text || null,
        status: 'ENVIADO',
        updatedAt: new Date(),
        createdAt: new Date(),
        recipientId: client.chatAsesorId,
        recipientWhatsapp: conversation?.empresa.whatsapp,
        messageID: dataMsg.messageId,
      }
    });

    
    const { data } = await metaApi.post(`/${phoneId}/messages`, mediaObj);
    const messageID = data.messages[0].id;

    await generalMessage.create({
      data: {
        mensaje: msg?.cuerpo || null,
        origen: 'BOT',
        messageID,
        appID: aplication.id,
        empresaId: conversation!.empresa.id,
        idOrigen: msg!.id,
        recipientId:  client.id,
        status: 'ENVIADO',
        recipientWhatsapp: dataMsg.from,
        updatedAt: new Date(),
        media: msg?.fileName,
        mediaType: msg?.mediaType,
      }
    });
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
