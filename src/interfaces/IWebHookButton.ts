
interface IWebHookButton {
  object: string;
  entry:  Entry[];
}

export interface Entry {
  id:      string;
  changes: Change[];
}

export interface Change {
  value: Value;
  field: string;
}

export interface Value {
  messaging_product: string;
  metadata:          Metadata;
  contacts:          Contact[];
  messages:          Message[];
}

export interface Contact {
  profile: Profile;
  wa_id:   string;
}

export interface Profile {
  name: string;
}

export interface Message {
  context:   Context;
  from:      string;
  id:        string;
  timestamp: string;
  type:      string;
  button:    Button;
}

export interface Button {
  payload: string;
  text:    string;
}

export interface Context {
  from: string;
  id:   string;
}

export interface Metadata {
  display_phone_number: string;
  phone_number_id:      string;
}

export default IWebHookButton;
