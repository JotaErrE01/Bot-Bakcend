export interface IReqType {
  entry:  Entry[];
  object: string;
}

interface Entry {
  id:      string;
  time:    number;
  changes: Change[];
}

interface Change {
  field: 'message_template_status_update' | 'messages';
}

