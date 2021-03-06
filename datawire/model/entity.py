import logging
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import aliased

from datawire.core import db, url_for
from datawire.model.user import User
from datawire.model.selector import Selector
from datawire.model.forms import EntityForm, CATEGORIES
from datawire.model.util import make_textid, db_compare

log = logging.getLogger(__name__)


class Entity(db.Model):
    id = db.Column(db.Unicode(50), primary_key=True, default=make_textid)
    label = db.Column(db.Unicode)
    category = db.Column(db.Enum(*CATEGORIES, name='entity_categories'),
                         nullable=False)

    creator_id = db.Column(db.Integer(), db.ForeignKey('user.id'))
    creator = db.relationship(User, backref=db.backref('entities',
                              lazy='dynamic', cascade='all, delete-orphan'))

    collection_id = db.Column(db.Unicode(50), db.ForeignKey('collection.id'))
    collection = db.relationship('Collection', backref=db.backref('entities',
                                 lazy='dynamic', cascade='all, delete-orphan'))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'api_url': url_for('entities.view', id=self.id),
            'label': self.label,
            'category': self.category,
            'creator_id': self.creator_id,
            'selectors': [s.text for s in self.selectors],
            'collection_id': self.collection_id,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    def has_selector(self, text):
        normalized = Selector.normalize(text)
        for selector in self.selectors:
            if selector.normalized == normalized:
                return True
        return False

    def delete(self):
        db.session.delete(self)

    @classmethod
    def create(cls, data, user):
        ent = cls()
        ent.update(data)
        ent.creator = user
        db.session.add(ent)
        return ent

    def update(self, data):
        data = EntityForm().deserialize(data)
        self.label = data.get('label')
        self.collection = data.get('collection')
        self.category = data.get('category')

        selectors = set(data.get('selectors'))
        selectors.add(self.label)
        existing = list(self.selectors)
        for sel in list(existing):
            if sel.text in selectors:
                selectors.remove(sel.text)
                existing.remove(sel)
        for sel in existing:
            db.session.delete(sel)
        for text in selectors:
            sel = Selector()
            sel.entity = self
            sel.text = text
            db.session.add(sel)

    @classmethod
    def by_normalized_label(cls, label, collection):
        q = db.session.query(cls)
        q = q.filter_by(collection=collection)
        q = q.filter(db_compare(cls.label, label))
        return q.first()

    @classmethod
    def by_id(cls, id):
        q = db.session.query(cls).filter_by(id=id)
        return q.first()

    @classmethod
    def by_collections(cls, collections, prefix=None):
        q = db.session.query(cls)
        q = q.filter(cls.collection_id.in_(collections))
        if prefix is not None and len(prefix):
            q = q.join(Selector, cls.id == Selector.entity_id)
            q = cls.apply_filter(q, Selector.normalized, prefix)
        q = q.order_by(cls.label.asc())
        return q

    @classmethod
    def by_id_set(cls, ids):
        if not len(ids):
            return {}
        q = db.session.query(cls)
        q = q.filter(cls.id.in_(ids))
        entities = {}
        for ent in q:
            entities[ent.id] = ent
        return entities

    @classmethod
    def apply_filter(cls, q, col, prefix):
        prefix = Selector.normalize(prefix)
        return q.filter(or_(col.like('%s%%' % prefix),
                            col.like('%% %s%%' % prefix)))

    @classmethod
    def suggest_prefix(cls, prefix, collections, limit=10):
        ent = aliased(Entity)
        sel = aliased(Selector)
        q = db.session.query(ent.id, ent.label, ent.category)
        q = q.join(sel, ent.id == sel.entity_id)
        q = q.filter(ent.collection_id.in_(collections))
        if prefix is None or not len(prefix):
            return []
        q = cls.apply_filter(q, sel.normalized, prefix)
        q = q.order_by(ent.label.asc())
        q = q.limit(limit)
        q = q.distinct()
        suggestions = []
        for entity_id, label, category in q.all():
            suggestions.append({
                'id': entity_id,
                'label': label,
                'category': category
            })
        return suggestions

    @property
    def terms(self):
        return set([s.normalized for s in self.selectors])

    def __repr__(self):
        return '<Entity(%r, %r)>' % (self.id, self.label)

    def __unicode__(self):
        return self.label
