import { Router } from 'express';
import { messages } from '../controllers';
import { metaApi } from '../api';

const router = Router();

router.get('/', (req, res) => {
  res.send('Hello World!');
})

// validar token con meta
router.get( '/webhook', messages.validarWebHookToken);

// controllar envios de mesnajes y responderlos
router.post( '/webhook', messages.messagesController );

router.post( '/send', async (req, res) => {
  try {
    // const botMessageData = {
    //   "messaging_product": "whatsapp",
    //   "to": `${593968806155}`,
    //   "type": "text",
    //   "text": {
    //     body: 'Disculpas, no te tengo registrado en mi base de datos 😢',
    //   },
    // };
    const botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${593968806155}`,
      "type": "template",
      "template": {
        "name": "hello_world",
        "language": { "code": "en_US" }
      },
    };
  
    const { data } = await metaApi.post(`/${104148912327082}/messages`, botMessageData);
    console.log(data);

    return res.status(200).json({ msg: 'Mensaje enviado' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: 'Error en el servidor' });
  }
  
} );

export default router;
