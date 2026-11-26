'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ContentService } from '@/services/main-website/contentService';
import { CategoryService } from '@/services/main-website/categoryService';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ImageUploader from '@/components/Common/ImageUploader';
import PageHeader from '@/components/common/PageHeader';
import CardWrapper from '@/components/Common/CardWrapper';
import { Button, Input, Select, RichTextEditor, Badge, Card, ConfirmModal } from '@/components/ui';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Clock,
  ExternalLink,
  Search,
  Save,
  X,
  Eye,
  Users,
  CheckCircle2,
} from '@/components/icons';

const EMPTY_FORM = {
  title: '',
  tagline: '',
  category: 'Flagship Event',
  date: new Date().toISOString().split('T')[0],
  startDate: '',
  endDate: '',
  time: '10:00 AM - 5:00 PM',
  venue: 'Main Auditorium, NIT Patna',
  mode: 'In-Person',
  status: 'Upcoming',
  description: '',
  eligibility: '',
  image: '',
  registrationLink: '#',
  highlights: [],
  speakers: [],
  sponsors: [],
};

export default function EventsManagementPage() {
  const { isSuperAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [highlightDraft, setHighlightDraft] = useState('');
  const [speakerDraft, setSpeakerDraft] = useState({ name: '', role: '' });
  const [sponsorDraft, setSponsorDraft] = useState({
    name: '',
    tier: 'Partner',
    website: '',
    logoUrl: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [items, cats] = await Promise.all([
        ContentService.getItems('events'),
        CategoryService.getCategories('events'),
      ]);
      setEvents(items || []);
      setCategories(cats || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddCategory = async () => {
    if (!newCatInput.trim()) return;
    const updated = await CategoryService.addCategory('events', newCatInput);
    if (updated) {
      setCategories(updated);
      setFormData((prev) => ({ ...prev, category: newCatInput.trim() }));
    }
    setNewCatInput('');
    setShowAddCat(false);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setHighlightDraft('');
    setSpeakerDraft({ name: '', role: '' });
    setSponsorDraft({ name: '', tier: 'Partner', website: '', logoUrl: '' });
    setFormData({
      ...EMPTY_FORM,
      category: categories[0] || 'Flagship Event',
      date: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setHighlightDraft('');
    setSpeakerDraft({ name: '', role: '' });
    setSponsorDraft({ name: '', tier: 'Partner', website: '', logoUrl: '' });
    setFormData({
      title: item.title || '',
      tagline: item.tagline || '',
      category: item.category || categories[0] || 'Flagship Event',
      date: item.date || new Date().toISOString().split('T')[0],
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      time: item.time || '',
      venue: item.venue || '',
      mode: item.mode || 'In-Person',
      status: item.status || 'Upcoming',
      description: item.description || '',
      eligibility: item.eligibility || '',
      image: item.image || '',
      registrationLink: item.registrationLink || '#',
      highlights: Array.isArray(item.highlights) ? item.highlights : [],
      speakers: Array.isArray(item.speakers) ? item.speakers : [],
      sponsors: Array.isArray(item.sponsors) ? item.sponsors : [],
    });
    setIsModalOpen(true);
  };

  const addHighlight = () => {
    const val = highlightDraft.trim();
    if (!val) return;
    setFormData((prev) => ({ ...prev, highlights: [...prev.highlights, val] }));
    setHighlightDraft('');
  };

  const removeHighlight = (idx) => {
    setFormData((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== idx),
    }));
  };

  const addSpeaker = () => {
    if (!speakerDraft.name.trim()) return;
    setFormData((prev) => ({
      ...prev,
      speakers: [
        ...prev.speakers,
        { name: speakerDraft.name.trim(), role: speakerDraft.role.trim() },
      ],
    }));
    setSpeakerDraft({ name: '', role: '' });
  };

  const removeSpeaker = (idx) => {
    setFormData((prev) => ({
      ...prev,
      speakers: prev.speakers.filter((_, i) => i !== idx),
    }));
  };

  const addSponsor = () => {
    if (!sponsorDraft.name.trim()) return;
    setFormData((prev) => ({
      ...prev,
      sponsors: [
        ...prev.sponsors,
        {
          name: sponsorDraft.name.trim(),
          tier: sponsorDraft.tier.trim() || 'Partner',
          website: sponsorDraft.website.trim() || '',
          logoUrl: sponsorDraft.logoUrl.trim() || '',
        },
      ],
    }));
    setSponsorDraft({ name: '', tier: 'Partner', website: '', logoUrl: '' });
  };

  const removeSponsor = (idx) => {
    setFormData((prev) => ({
      ...prev,
      sponsors: prev.sponsors.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const payload = {
      ...formData,
      tagline: formData.tagline.trim() || null,
      startDate: formData.startDate.trim() || null,
      endDate: formData.endDate.trim() || null,
      eligibility: formData.eligibility.trim() || null,
    };

    if (editingItem) {
      await ContentService.updateItem('events', editingItem.id, payload);
    } else {
      await ContentService.addItem('events', payload);
    }
    await loadData();
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await ContentService.deleteItem('events', deleteId);
    await loadData();
    setDeleteId(null);
  };

  const filteredEvents = events.filter(
    (ev) =>
      ev.title.toLowerCase().includes(search.toLowerCase()) ||
      ev.category?.toLowerCase().includes(search.toLowerCase()) ||
      ev.tagline?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_EVENTS}>
      <div className="space-y-5 animate-in fade-in duration-200">
        <PageHeader
          icon={CalendarDays}
          title="Manage Events"
          description="Organize complete event details: schedule, mode, tagline, highlights, speakers, sponsors, and eligibility."
          actionText="Add Event"
          actionIcon={Plus}
          onAction={handleOpenAdd}
        />

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <Input
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, tagline, or category..."
            className="w-full sm:w-80"
          />
          <Badge variant="slate">Total Events: {events.length}</Badge>
        </div>

        <CardWrapper className="p-0 border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                  <th className="py-3 px-4">Event Title &amp; Category</th>
                  <th className="py-3 px-4">Schedule, Venue &amp; Mode</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((ev) => (
                    <tr
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          {ev.image ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={ev.image}
                              alt={ev.title}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=200&auto=format&fit=crop&q=80';
                              }}
                              className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#1E40AF] flex items-center justify-center shrink-0 border border-blue-100">
                              <CalendarDays className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-[#1E40AF] transition-colors truncate max-w-[260px]">
                              {ev.title}
                            </p>
                            {ev.tagline && (
                              <p className="text-[11px] text-slate-500 font-normal truncate max-w-[260px]">
                                {ev.tagline}
                              </p>
                            )}
                            <span className="text-[10px] text-[#1E40AF] font-semibold">
                              {ev.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex flex-col gap-0.5 text-[11px]">
                          <span className="font-semibold text-slate-800">{ev.date}</span>
                          {ev.time && (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {ev.time}
                            </span>
                          )}
                          {ev.venue && (
                            <span className="text-slate-500 flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="w-3 h-3 shrink-0" /> {ev.venue}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="slate" size="xs">
                            {ev.mode || 'In-Person'}
                          </Badge>
                          {Array.isArray(ev.speakers) && ev.speakers.length > 0 && (
                            <Badge variant="blue" size="xs">
                              {ev.speakers.length} Speakers
                            </Badge>
                          )}
                          {Array.isArray(ev.highlights) && ev.highlights.length > 0 && (
                            <Badge variant="purple" size="xs">
                              {ev.highlights.length} Highlights
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            ev.status === 'Upcoming'
                              ? 'emerald'
                              : ev.status === 'Live Today' || ev.status === 'Ongoing'
                              ? 'amber'
                              : 'slate'
                          }
                          showDot
                        >
                          {ev.status}
                        </Badge>
                      </td>

                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            icon={Eye}
                            onClick={() => setSelectedEvent(ev)}
                            title="View Full Details"
                          />
                          <Button
                            variant="outline"
                            size="xs"
                            icon={Edit2}
                            onClick={() => handleOpenEdit(ev)}
                            title="Edit Event"
                          />
                          <Button
                            variant="outline"
                            size="xs"
                            icon={Trash2}
                            className="hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                            onClick={() => setDeleteId(ev.id)}
                            title="Delete Event"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400 text-xs">
                      No events found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardWrapper>

        {/* Delete Confirmation */}
        <ConfirmModal
          isOpen={Boolean(deleteId)}
          onClose={() => setDeleteId(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Event"
          message="Are you sure you want to delete this event? It will be removed from the main website."
        />

        {/* View Full Event Details Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto my-auto rounded-lg bg-white border border-[#E2E8F0] p-6 shadow-xl space-y-4 animate-in zoom-in-95 font-sans">
              <div className="flex items-start justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="blue">{selectedEvent.category}</Badge>
                  <Badge variant="slate">{selectedEvent.mode || 'In-Person'}</Badge>
                  <Badge
                    variant={
                      selectedEvent.status === 'Upcoming'
                        ? 'emerald'
                        : selectedEvent.status === 'Live Today' ||
                          selectedEvent.status === 'Ongoing'
                        ? 'amber'
                        : 'slate'
                    }
                    showDot
                  >
                    {selectedEvent.status}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 text-slate-400 hover:text-slate-800 rounded-md hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedEvent.image && (
                <div className="w-full h-48 rounded-md overflow-hidden border border-[#E2E8F0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedEvent.image}
                    alt={selectedEvent.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedEvent.title}</h2>
                {selectedEvent.tagline && (
                  <p className="text-xs font-medium text-[#1E40AF] mt-0.5">
                    {selectedEvent.tagline}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <CalendarDays className="w-4 h-4 text-[#1E40AF] shrink-0" />
                  <span>
                    <strong>Date:</strong> {selectedEvent.date}
                    {selectedEvent.startDate && ` (${selectedEvent.startDate}${selectedEvent.endDate ? ` to ${selectedEvent.endDate}` : ''})`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-[#1E40AF] shrink-0" />
                  <span>
                    <strong>Timing:</strong> {selectedEvent.time || 'TBD'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-[#1E40AF] shrink-0" />
                  <span>
                    <strong>Venue:</strong> {selectedEvent.venue || 'NIT Patna'}
                  </span>
                </div>
                {selectedEvent.registrationLink && selectedEvent.registrationLink !== '#' && (
                  <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
                    <ExternalLink className="w-4 h-4 text-[#1E40AF] shrink-0" />
                    <a
                      href={selectedEvent.registrationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1E40AF] font-semibold hover:underline truncate"
                    >
                      {selectedEvent.registrationLink}
                    </a>
                  </div>
                )}
              </div>

              {selectedEvent.description && (
                <div
                  className="text-xs text-slate-600 leading-relaxed prose prose-xs max-w-none bg-slate-50/70 p-3 rounded border border-slate-100"
                  dangerouslySetInnerHTML={{ __html: selectedEvent.description }}
                />
              )}

              {Array.isArray(selectedEvent.highlights) && selectedEvent.highlights.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Key Highlights
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {selectedEvent.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(selectedEvent.speakers) && selectedEvent.speakers.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Speakers &amp; Mentors
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedEvent.speakers.map((sp, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      >
                        <p className="font-bold text-slate-900">{sp.name}</p>
                        {sp.role && <p className="text-[11px] text-slate-500">{sp.role}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(selectedEvent.sponsors) && selectedEvent.sponsors.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Sponsors &amp; Partners
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.sponsors.map((sp, i) => (
                      <Badge key={i} variant="blue" size="xs">
                        {sp.name} {sp.tier ? `(${sp.tier})` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.eligibility && (
                <div className="p-3 rounded-md bg-blue-50/70 border border-blue-100 text-xs text-slate-700">
                  <strong className="text-[#1E40AF]">Eligibility &amp; Guidelines:</strong>{' '}
                  {selectedEvent.eligibility}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <Button
                  variant="outline"
                  icon={Edit2}
                  onClick={() => {
                    const ev = selectedEvent;
                    setSelectedEvent(null);
                    handleOpenEdit(ev);
                  }}
                >
                  Edit Event
                </Button>
                <Button variant="primary" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Create / Edit Event Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto my-auto rounded-md bg-white border border-[#E2E8F0] p-5 shadow-xl space-y-4 animate-in zoom-in-95 font-sans">
              <Card.Header>
                <Card.Title>{editingItem ? 'Edit Event' : 'Create New Event'}</Card.Title>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-800 rounded-md hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </Card.Header>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Event Title *"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Pitchtember 2026"
                  />
                  <Input
                    label="Tagline / Subtitle"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    placeholder="e.g. Where Fiction Gets Funded"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <label className="block text-slate-700 font-semibold">Category</label>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => setShowAddCat((p) => !p)}
                          className="text-[10px] text-[#1E40AF] hover:underline font-semibold"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    {showAddCat ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={newCatInput}
                          onChange={(e) => setNewCatInput(e.target.value)}
                          placeholder="New..."
                        />
                        <Button size="xs" onClick={handleAddCategory}>
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        options={categories}
                      />
                    )}
                  </div>

                  <Select
                    label="Status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={['Upcoming', 'Live Today', 'Ongoing', 'Completed', 'Past']}
                  />

                  <Select
                    label="Mode"
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                    options={['In-Person', 'Online', 'Hybrid']}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Display Date *"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    placeholder="e.g. 2026-09-19 or Nov 2026"
                  />
                  <Input
                    label="Start Date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Timing"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    placeholder="e.g. 10:00 AM - 5:00 PM"
                  />
                  <Input
                    label="Venue / Location"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g. CV Raman Hall"
                  />
                  <Input
                    label="Registration / Archive Link"
                    value={formData.registrationLink}
                    onChange={(e) =>
                      setFormData({ ...formData, registrationLink: e.target.value })
                    }
                    placeholder="https://... or #"
                  />
                </div>

                <ImageUploader
                  label="Event Poster / Banner Image"
                  value={formData.image}
                  onChange={(url) => setFormData({ ...formData, image: url })}
                  placeholder="Upload poster or paste URL"
                />

                <RichTextEditor
                  label="About the Event (Description)"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed event description..."
                />

                <Input
                  label="Eligibility & Guidelines"
                  value={formData.eligibility}
                  onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
                  placeholder="e.g. All NIT Patna students, startups, and mentors..."
                />

                {/* Key Highlights */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Key Highlights ({formData.highlights.length})
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={highlightDraft}
                      onChange={(e) => setHighlightDraft(e.target.value)}
                      placeholder="Add highlight point..."
                    />
                    <Button type="button" size="sm" onClick={addHighlight} icon={Plus}>
                      Add
                    </Button>
                  </div>
                  {formData.highlights.length > 0 && (
                    <div className="space-y-1">
                      {formData.highlights.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-slate-200 text-xs"
                        >
                          <span className="truncate">{h}</span>
                          <button
                            type="button"
                            onClick={() => removeHighlight(idx)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Speakers & Mentors */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Speakers &amp; Mentors ({formData.speakers.length})
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <div className="sm:col-span-2">
                      <Input
                        value={speakerDraft.name}
                        onChange={(e) =>
                          setSpeakerDraft({ ...speakerDraft, name: e.target.value })
                        }
                        placeholder="Speaker Name"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        value={speakerDraft.role}
                        onChange={(e) =>
                          setSpeakerDraft({ ...speakerDraft, role: e.target.value })
                        }
                        placeholder="Role / Designation"
                      />
                    </div>
                    <Button type="button" size="sm" onClick={addSpeaker} icon={Plus}>
                      Add
                    </Button>
                  </div>
                  {formData.speakers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.speakers.map((sp, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200 text-xs"
                        >
                          <strong>{sp.name}</strong>
                          {sp.role && <span className="text-slate-500">({sp.role})</span>}
                          <button
                            type="button"
                            onClick={() => removeSpeaker(idx)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sponsors & Partners */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Sponsors &amp; Partners ({formData.sponsors.length})
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input
                      value={sponsorDraft.name}
                      onChange={(e) =>
                        setSponsorDraft({ ...sponsorDraft, name: e.target.value })
                      }
                      placeholder="Sponsor Name"
                    />
                    <Input
                      value={sponsorDraft.tier}
                      onChange={(e) =>
                        setSponsorDraft({ ...sponsorDraft, tier: e.target.value })
                      }
                      placeholder="Tier (e.g. Title)"
                    />
                    <Input
                      value={sponsorDraft.website}
                      onChange={(e) =>
                        setSponsorDraft({ ...sponsorDraft, website: e.target.value })
                      }
                      placeholder="Website URL"
                    />
                    <Button type="button" size="sm" onClick={addSponsor} icon={Plus}>
                      Add
                    </Button>
                  </div>
                  {formData.sponsors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.sponsors.map((sp, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200 text-xs"
                        >
                          <strong>{sp.name}</strong>
                          {sp.tier && <span className="text-slate-500">({sp.tier})</span>}
                          <button
                            type="button"
                            onClick={() => removeSponsor(idx)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                  <Button
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" icon={Save} className="w-full sm:w-auto">
                    Save Event
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
