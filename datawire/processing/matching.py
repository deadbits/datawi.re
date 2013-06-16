import logging

from datawire.core import db
from datawire.model import Match
from datawire.model.util import itervalues
from datawire.processing.entity import get_filters

log = logging.getLogger(__name__)


def match(frame, pattern, entity_ids):
    matches = []
    for k, v in itervalues(frame.get('data'), 'data'):
        rem = pattern.search(unicode(v))
        if rem is None:
            continue
        for entity_id in entity_ids:
            if not Match.exists(frame['urn'], entity_id):
                field = k.split('.', 1).pop()
                match = Match.create(frame['urn'], field, entity_id)
                log.info("match: %s", match)
                matches.append(match)
    return matches


def match_frame(frame):
    filters = get_filters()
    for pattern, entity_ids in filters:
        match(frame, pattern, entity_ids)
    db.session.commit()


def handle_matching(body, message):
    routing_key = message.delivery_info.get('routing_key')
    log.info('%s - received: %s', routing_key, body['urn'])
    match_frame(body)
