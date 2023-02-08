import { prisma } from '../db/config';

export const savePollResults = async (response: string, client: any) => {
  const { conversacion, encuestas, mensaje, cliente } = prisma;

  try {
    const clientConversation = await conversacion.findUnique({
      where: {
        id: client.conversacionId,
      }
    });

    if(client.ultimoMensajeId === null) {
      const mainMessage = await mensaje.findFirst({
        where: {
          conversacionId: client.conversacionId,
          predecesorId: null,
        }
      });

      if(!mainMessage) return false;

      await cliente.update({
        where: {
          id: client.id,
        },
        data: {
          ultimoMensajeId: mainMessage?.id,
        }
      });

      return true;
    }

    const lastMessageClient = await mensaje.findUnique({
      where: {
        id: client.ultimoMensajeId,
      }
    });

    if (clientConversation?.categoria === 'POLL') {
      await encuestas.create({
        data: {
          clienteId: client.id,
          nombreCliente: client.nombre,
          apellidoCliente: client.apellido,
          conversacionId: client.conversacionId,
          empresaId: client.empresaId,
          mensajeId: client.ultimoMensajeId,
          mensajePregunta: lastMessageClient?.cuerpo || '',
          respuestaCliente: response,
          whatsappCliente: client.whatsapp,
          updatedAt: new Date(),
        }
      });
    };

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
