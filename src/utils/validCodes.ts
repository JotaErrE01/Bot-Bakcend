import { prisma } from '../db/config';
import { formatVariables } from './formatVariables';
import { AxiosInstance } from 'axios';

export const validCodes = async (client: any, text: string, botMessageData: any, metaApi: AxiosInstance, phoneId: string, isMainMessage: boolean) => {
  const { mensaje, cliente } = prisma;
  const { longName, shortName, codigo, ...rest } = client;

  let msg: any = null;
  try {
    const mensajeDb = await mensaje.findUnique({
      where: {
        id: client.ultimoMensajeId,
      }
    });

    // verificar si quiere regresar al mensaje principal
    if (text.toLowerCase() === mensajeDb?.backToMainCode?.toLowerCase() && !isMainMessage) {
      msg = await mensaje.findFirst({
        where: { conversacionId: client.conversacionId, predecesorId: null }
      });

      if (msg) {
        await cliente.update({
          where: {
            id: client.id,
          },
          data: {
            ...rest,
            ultimoMensajeId: msg.id,
          }
        });
      }
    }

    // verificar si quiere regresar al mensaje anterior
    if (text.toLowerCase() === mensajeDb?.backToLastMessageCode?.toLowerCase() && !isMainMessage) {
      msg = await mensaje.findUnique({
        where: {
          id: mensajeDb.predecesorId!,
        }
      });

      if (msg) {
        await cliente.update({
          where: {
            id: client.id,
          },
          data: {
            ...rest,
            ultimoMensajeId: msg.id,
          }
        });
      }
    }

    // verificar si quiere repetir el mensaje
    if (text.toLowerCase() === mensajeDb?.repeatMessageCode?.toLowerCase()) {
      msg = await mensaje.findUnique({
        where: {
          id: client.ultimoMensajeId,
        }
      });
    }

    if (!msg) return false;

    botMessageData.text.body = formatVariables((msg!.cuerpo as string), client)!;

    await metaApi.post(`/${phoneId}/messages`, botMessageData);

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}