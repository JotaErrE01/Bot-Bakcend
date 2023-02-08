import { prisma } from '../db/config';
import { AxiosInstance } from 'axios';
import { Response } from 'express';

export const RegisterBot = async (empresaId: string, metaApi: AxiosInstance, phoneId: string, botMessageData: any, waId: string, res: Response) => {
  try {
    const { cliente, conversacion, mensaje, paises } = prisma;

    const countries = await paises.findMany({
      where: {
        isDeleted: false
      }
    });
    const clientCountry = countries.find(country => waId.startsWith(country.codigo.toString()));

    if(!clientCountry) return res.status(200).json({ msg: 'No se encontro el pais' });

    const registerBot = await conversacion.findFirst({
      where: { categoria: 'REGISTER', empresaId, isDeleted: false },
      include: {
        mensajes: {
          where: { predecesorId: null, isDeleted: false }
        },
      }
    });

    if(!registerBot) return res.status(200).json({ msg: 'No hay un bot de registro' });

    const registerClient = await cliente.create({
      data: {
        ultimoMensajeId: null,
        isChating: false,
        apellido: 'REGISTER',
        nombre: 'REGISTER',
        email: '',
        empresaId,
        chatAsesorId: null,
        whatsapp: waId.replace(`${clientCountry.codigo}`, ''),
        conversacionId: registerBot.id,
        paisId: clientCountry.id,
      }
    });

    botMessageData.text.body = registerBot.mensajes[0].cuerpo;

    await metaApi.post(`/${phoneId}/messages`, botMessageData);

    const mensajeNombre = await mensaje.findFirst({
      where: { predecesorId: registerBot.mensajes[0].id, isDeleted: false },
    });

    botMessageData.text.body = mensajeNombre?.cuerpo;
    await metaApi.post(`/${phoneId}/messages`, botMessageData);

    await cliente.update({
      where: { id: registerClient.id },
      data: {
        ...registerClient,
        ultimoMensajeId: mensajeNombre?.id,
      }
    })

  } catch (error) {
    console.log(error);
    return res.status(200).json({ msg: 'Error al conectar con otro bot', error });
  }
}