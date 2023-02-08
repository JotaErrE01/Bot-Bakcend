import { Cliente } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../db/config';
import { AxiosInstance } from 'axios';
import { formatVariables } from './formatVariables';

export const registerClient = async (client: Cliente, text: string, res: Response, metaApi: AxiosInstance, phoneId: string, botMessageData: any) => {
  // let ultimoMensajeId = null;
  const { cliente, mensaje } = prisma;

  try {
    if (client.nombre === 'REGISTER') {
      await cliente.update({
        where: {
          id: client.id
        },
        data: {
          nombre: text
        }
      });
      const msgApellido = await mensaje.findFirst({
        where: { predecesorId: client.ultimoMensajeId, isDeleted: false },
      });

      if (!msgApellido) return res.status(200).json({ msg: 'No hay Mensaje apellido' });
      botMessageData.text.body = msgApellido.cuerpo!;
      await metaApi.post(`/${phoneId}/messages`, botMessageData);

      await cliente.update({
        where: {
          id: client.id
        },
        data: {
          ultimoMensajeId: msgApellido.id,
        }
      });
    } else if (client.apellido === 'REGISTER') {
      client = await cliente.update({
        where: {
          id: client.id
        },
        data: {
          apellido: text
        }
      });
      const msgBot = await mensaje.findFirst({
        where: { predecesorId: client.ultimoMensajeId, isDeleted: false },
      });
      if (!msgBot) return res.status(200).json({ msg: 'No hay Mensaje bot' });

      const botRedirection = await mensaje.findFirst({
        where: {
          conversacionId: msgBot!.botIdConexion!,
          predecesorId: null,
          isDeleted: false,
        },
      });
      if (!botRedirection) return res.status(200).json({ msg: 'No hay Mensaje bot' });
      botMessageData.text.body = formatVariables(botRedirection.cuerpo!, client);
      await metaApi.post(`/${phoneId}/messages`, botMessageData);

      await cliente.update({
        where: {
          id: client.id
        },
        data: {
          ultimoMensajeId: botRedirection.id,
          conversacionId: msgBot.botIdConexion,
        }
      });
    }

    return res.status(200).json({ msg: 'Mensaje Enviado' });
  } catch (error) {
    console.log(error);
    return res.status(200).json({ msg: 'Error al registrar el cliente' });
  }
}