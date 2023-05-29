import { AxiosInstance } from 'axios';
import { Mensaje, Cliente, App } from '@prisma/client';
import { prisma } from '../db/config';
import { formatVariables } from './formatVariables';
import { Response } from 'express';
import { IGetDataMessage } from './messages/getDataMessage';


export const connectToOtherBot = async (msg: Mensaje, client: Cliente, metaApi: AxiosInstance, botMessageData: any, phoneId: string, res: Response, aplication: App, dataMsg: IGetDataMessage) => {
  const { conversacion, cliente, generalMessage } = prisma;

  try {

    console.log('💩💩💩💩');
    console.log('💩💩💩💩');
    

    const newBot = await conversacion.findUnique({
      where: { id: msg.botIdConexion! },
      include: {
        mensajes: {
          where: { predecesorId: null },
        },
      }
    });
    
    const newMsg = newBot?.mensajes[0];
    
    await cliente.update({
      where: { id: client.id },
      data: {
        conversacionId: newBot?.id,
        ultimoMensajeId: newMsg?.id,
        isChating: false,
        chatAsesorId: null,
      }
    });

    // await generalMessages.create({
    //   data: {
    //     appID: aplication.id,
    //     empresaId: aplication.empresaId,
    //     idOrigen: client.id,
    //     origen: 'CLIENTE',
    //     mensaje: dataMsg.text || null,
    //     status: 'ENVIADO',
    //     updatedAt: new Date(),
    //     createdAt: new Date(),
    //     messageID: dataMsg.messageId,
    //   }
    // });

    botMessageData.text.body = formatVariables(newMsg?.cuerpo as string, client)!;

    const { data } = await metaApi.post(`/${phoneId}/messages`, botMessageData);

    // await generalMessages.create({
    //   data: {
    //     appID: aplication.id,
    //     empresaId: aplication.empresaId,
    //     idOrigen: (msg as any).id,
    //     origen: 'BOT',
    //     mensaje: botMessageData.text.body,
    //     status: 'ENVIADO',
    //     updatedAt: new Date(),
    //     createdAt: new Date(),
    //     messageID: data.messages[0].id,
    //     recipientId: client.id,
    //     recipientWhatsapp: client.whatsapp,
    //   }
    // });

    return res.status(200).json({ msg: 'Message Sent' });
  } catch (error) {
    console.log(error);
    return res.status(200).json({ msg: 'Error To Connect with Other Bot' });
  }
}