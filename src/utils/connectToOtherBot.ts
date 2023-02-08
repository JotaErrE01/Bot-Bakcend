import { AxiosInstance } from 'axios';
import { Mensaje, Cliente } from '@prisma/client';
import { prisma } from '../db/config';
import { formatVariables } from './formatVariables';
import { Response } from 'express';


export const connectToOtherBot = async (msg: Mensaje, client: Cliente, metaApi: AxiosInstance, botMessageData: any, phoneId: string, res: Response) => {
  const { conversacion, cliente } = prisma;

  try {
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

    botMessageData.text.body = formatVariables(newMsg?.cuerpo as string, client)!;
    await metaApi.post(`/${phoneId}/messages`, botMessageData);
    return res.status(200).json({ msg: 'Message Sent' });
  } catch (error) {
    console.log(error);
    return res.status(200).json({ msg: 'Error To Connect with Other Bot' });
  }
}