'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { subscriptionsApi, addressesApi, authApi } from '@/lib/api';
import { Subscription, Address } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nextDeliveryShortLabelIST } from '@/lib/utils/subscriptionNextDelivery';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './page.module.css';

const AddressLocationPicker = dynamic(() => import('@/components/AddressLocationPicker'), { ssr: false });

function isAddressLockedByAnyExistingSubscription(subscriptions: { addressId?: string; status?: string }[], addressId: string): boolean {
  return subscriptions.some((sub) => {
    if (String(sub.addressId || '') !== String(addressId)) return false;
    const status = String(sub.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'expired';
  });
}

/**
 * Customer Dashboard
 * Profile information and addresses. Mobile-first UI.
 */
export default function DashboardPage() {
  const { user, refreshUser, isAdmin, logout } = useAuth();
  const { showToast } = useToast();
  const pathname = usePathname();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile edit states
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Personal info edit state
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editWeddingDate, setEditWeddingDate] = useState('');
  const [showUserIdTooltip, setShowUserIdTooltip] = useState(false);

  // Address edit states
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    phone: '',
    isDefault: false,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  // Derived: split name into first/last
  const nameParts = (user?.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const copyUserId = useCallback(async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      showToast('User ID copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    if (!showUserIdTooltip) return;
    const handleDocumentClick = () => {
      setShowUserIdTooltip(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showUserIdTooltip]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const subsPromise = subscriptionsApi.getAll().catch(() => []);
        const addrsPromise = user
          ? addressesApi.getAll().catch(() => [])
          : Promise.resolve([]);
        const [subsData, addrsData] = await Promise.all([subsPromise, addrsPromise]);
        setSubscriptions(subsData);
        setAddresses(Array.isArray(addrsData) ? addrsData : []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Open personal info edit mode
  const openEditPersonal = () => {
    setEditFirstName(firstName);
    setEditLastName(lastName);
    setEditEmail(user?.email || '');
    setEditPhone(user?.phone || '');
    setEditDob(user?.dateOfBirth || '');
    setEditWeddingDate(user?.weddingDate || '');
    setIsEditingPersonal(true);
  };

  const handleSavePersonal = async () => {
    const fullName = `${editFirstName.trim()} ${editLastName.trim()}`.trim();
    if (!fullName) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.updateProfile({
        name: fullName,
        email: editEmail.trim(),
        phone: editPhone.trim(),
        dateOfBirth: editDob || null,
        weddingDate: editWeddingDate || null,
      });
      await refreshUser();
      showToast('Profile updated successfully', 'success');
      setIsEditingPersonal(false);
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Failed to update profile. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showToast('Please fill in all password fields', 'error');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      showToast('Password changed successfully', 'success');
      setIsEditingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Failed to change password. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      name: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      phone: '',
      isDefault: false,
      latitude: undefined,
      longitude: undefined,
    });
    setIsAddingAddress(false);
    setEditingAddressId(null);
  };

  const handleAddAddress = async () => {
    if (!addressForm.name || !addressForm.street || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      alert('Please fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const newAddress = await addressesApi.create(addressForm);
      setAddresses((prev) => [...prev, newAddress]);
      resetAddressForm();
    } catch {
      alert('Failed to add address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      name: address.name,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone || '',
      isDefault: address.isDefault || false,
      latitude: address.latitude,
      longitude: address.longitude,
    });
  };

  const handleUpdateAddress = async () => {
    if (!editingAddressId) return;
    if (!addressForm.name || !addressForm.street || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      alert('Please fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isAddressLockedByAnyExistingSubscription(subscriptions, editingAddressId)) {
        alert('This address is already used in an existing subscription. Please add a new address for future subscriptions.');
        return;
      }
      const updated = await addressesApi.update(editingAddressId, addressForm);
      setAddresses((prev) => prev.map((a) => (a.id === editingAddressId ? updated : a)));
      resetAddressForm();
    } catch {
      alert('Failed to update address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    setIsSubmitting(true);
    try {
      await addressesApi.delete(addressId);
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      if (editingAddressId === addressId) resetAddressForm();
    } catch {
      alert('Failed to delete address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner fullHeight />
      </CustomerSidebarLayout>
    );
  }

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status !== 'cancelled' && sub.status !== 'expired'
  );

  return (
    <CustomerSidebarLayout>
      <h1 className={styles.pageTitle}>My Account</h1>

      {/* Profile Card */}
      <section className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User'}
                className={styles.avatarImage}
              />
            ) : (
              initial
            )}
          </div>
          <div className={styles.profileMain}>
            <h2 className={styles.profileName}>{user?.name || 'User'}</h2>
            <p className={styles.profileTitle}>{user?.role === 'admin' ? 'Admin' : 'Customer'}</p>
            <p className={styles.profileLocation}>{user?.email || ''}</p>
          </div>
          <button
            className={styles.editIconButton}
            onClick={openEditPersonal}
            aria-label="Edit profile"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Edit</span>
          </button>
        </div>
      </section>

      {/* Personal Information */}
      <section className={styles.infoCard}>
        <div className={styles.infoCardHeader}>
          <h2 className={styles.infoCardTitle}>Personal information</h2>
          {!isEditingPersonal && (
            <button className={styles.editIconButton} onClick={openEditPersonal} aria-label="Edit personal info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Edit</span>
            </button>
          )}
        </div>

        {isEditingPersonal ? (
          <div className={styles.infoForm}>
            <div className={styles.infoGrid}>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>First Name</label>
                <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className={styles.infoFieldInput} placeholder="First name" />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Last Name</label>
                <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className={styles.infoFieldInput} placeholder="Last name" />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Email address</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={styles.infoFieldInput} placeholder="Email" />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Phone</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className={styles.infoFieldInput} placeholder="Phone number" />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Date of Birth</label>
                <input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} className={styles.infoFieldInput} />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Wedding Date</label>
                <input type="date" value={editWeddingDate} onChange={(e) => setEditWeddingDate(e.target.value)} className={styles.infoFieldInput} />
              </div>
            </div>
            <div className={styles.infoFormActions}>
              <button onClick={handleSavePersonal} disabled={isSubmitting} className={`${styles.btn} ${styles.btnPrimary}`}>Save Changes</button>
              <button onClick={() => setIsEditingPersonal(false)} disabled={isSubmitting} className={`${styles.btn} ${styles.btnSecondary}`}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className={styles.infoGrid}>
            <div className={styles.infoField}>
              <span className={styles.infoFieldLabel}>First Name</span>
              <span className={styles.infoFieldValue}>{firstName || '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoFieldLabel}>Last Name</span>
              <span className={styles.infoFieldValue}>{lastName || '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoFieldLabel}>Email address</span>
              <span className={styles.infoFieldValue}>{user?.email || '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoFieldLabel}>Phone</span>
              <span className={styles.infoFieldValue}>{user?.phone || '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoFieldLabel}>Date of Birth</span>
              <span className={styles.infoFieldValue}>{user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
            </div>
            <div className={styles.infoField}>
              <span className={styles.infoFieldLabel}>Wedding Date</span>
              <span className={styles.infoFieldValue}>{user?.weddingDate ? new Date(user.weddingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
            </div>
          </div>
        )}

        {/* Password change - still accessible */}
        <div className={styles.passwordSection}>
          {isEditingPassword ? (
            <div className={styles.passwordFields}>
              <div className={styles.infoGrid}>
                <div className={styles.infoField}>
                  <label className={styles.infoFieldLabel}>Current Password</label>
                  <input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} placeholder="Current password" className={styles.infoFieldInput} />
                </div>
                <div className={styles.infoField}>
                  <label className={styles.infoFieldLabel}>New Password</label>
                  <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} placeholder="New password" className={styles.infoFieldInput} />
                </div>
                <div className={styles.infoField}>
                  <label className={styles.infoFieldLabel}>Confirm New Password</label>
                  <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} placeholder="Confirm new password" className={styles.infoFieldInput} />
                </div>
              </div>
              <div className={styles.infoFormActions}>
                <button onClick={handleChangePassword} disabled={isSubmitting} className={`${styles.btn} ${styles.btnPrimary}`}>Change Password</button>
                <button
                  onClick={() => {
                    setIsEditingPassword(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  disabled={isSubmitting}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsEditingPassword(true)} className={styles.changePasswordBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Change Password
            </button>
          )}
        </div>
      </section>

      <section className={styles.userIdFooterCard} aria-label="Your user ID">
        <div className={`${styles.profileUserIdRow} ${styles.profileUserIdRowFooter}`}>
          <div className={styles.labelContainer}>
            <span className={styles.profileUserIdLabel}>User ID</span>
            <button
              type="button"
              className={styles.infoButton}
              onClick={(e) => {
                e.stopPropagation();
                setShowUserIdTooltip(!showUserIdTooltip);
              }}
              aria-label="Show User ID explanation"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
            {showUserIdTooltip && (
              <div className={styles.tooltip}>
                This userID can help us in case you are stuck with any of the thing
              </div>
            )}
          </div>
          <div className={styles.profileUserIdLine}>
            <span className={styles.profileUserId} title={user?.id}>
              {user?.id}
            </span>
            <button
              type="button"
              className={styles.profileUserIdCopy}
              onClick={() => void copyUserId()}
              aria-label="Copy user ID"
            >
              <svg className={styles.profileUserIdCopyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Address */}
      <section className={styles.infoCard}>
        <div className={styles.infoCardHeader}>
          <h2 className={styles.infoCardTitle}>Address</h2>
          {!isAddingAddress && !editingAddressId && addresses.length > 0 && (
            <button className={styles.editIconButton} onClick={() => setIsAddingAddress(true)} aria-label="Add address">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Add</span>
            </button>
          )}
        </div>

        {(isAddingAddress || editingAddressId) && (
          <div className={styles.addressForm}>
            <div className={styles.infoGrid}>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Address Name (e.g. Home, Office)</label>
                <input type="text" value={addressForm.name} onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })} placeholder="Home" className={styles.infoFieldInput} />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Street Address</label>
                <input type="text" value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} placeholder="Street address" className={styles.infoFieldInput} />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>City</label>
                <input type="text" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} placeholder="City" className={styles.infoFieldInput} />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>State</label>
                <input type="text" value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} placeholder="State" className={styles.infoFieldInput} />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Postal Code</label>
                <input type="text" value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} placeholder="Postal code" className={styles.infoFieldInput} />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Phone</label>
                <input type="tel" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} placeholder="Phone number" className={styles.infoFieldInput} />
              </div>
              <div className={styles.infoField}>
                <label className={styles.infoFieldLabel}>Country</label>
                <input type="text" value={addressForm.country} onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} placeholder="Country" className={styles.infoFieldInput} />
              </div>
            </div>
            <label className={styles.formCheckbox}>
              <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} />
              Set as default address
            </label>
            <AddressLocationPicker
              latitude={addressForm.latitude}
              longitude={addressForm.longitude}
              onChange={({ latitude, longitude }) => setAddressForm({ ...addressForm, latitude, longitude })}
            />
            <div className={styles.infoFormActions}>
              <button onClick={editingAddressId ? handleUpdateAddress : handleAddAddress} disabled={isSubmitting} className={`${styles.btn} ${styles.btnPrimary}`}>{editingAddressId ? 'Update Address' : 'Add Address'}</button>
              <button onClick={resetAddressForm} disabled={isSubmitting} className={`${styles.btn} ${styles.btnSecondary}`}>Cancel</button>
            </div>
          </div>
        )}

        {addresses.length === 0 && !isAddingAddress ? (
          <div className={styles.emptyAddresses}>
            <p>No addresses saved yet.</p>
            <button onClick={() => setIsAddingAddress(true)} className={`${styles.btn} ${styles.btnPrimary}`}>Add Address</button>
          </div>
        ) : (
          <div className={styles.addressesList}>
            {addresses.map((addr) => (
              <div key={addr.id} className={`${styles.addressCard} ${addr.isDefault ? styles.addressCardDefault : ''}`}>
                <div className={styles.addressCardHead}>
                  <h3 className={styles.addressCardTitle}>{addr.name}</h3>
                  <div className={styles.addressCardActions}>
                    {addr.isDefault && <span className={styles.defaultBadge}>Default</span>}
                    <button onClick={() => handleEditAddress(addr)} className={styles.editIconButton} aria-label="Edit address">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteAddress(addr.id)} disabled={isSubmitting} className={styles.deleteIconButton} aria-label="Delete address">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className={styles.addressCardBody}>
                  <div className={styles.addressInfoGrid}>
                    <div className={styles.infoField}>
                      <span className={styles.infoFieldLabel}>Country</span>
                      <span className={styles.infoFieldValue}>{addr.country}</span>
                    </div>
                    <div className={styles.infoField}>
                      <span className={styles.infoFieldLabel}>City / State</span>
                      <span className={styles.infoFieldValue}>{addr.city}, {addr.state}</span>
                    </div>
                    <div className={styles.infoField}>
                      <span className={styles.infoFieldLabel}>Postal Code</span>
                      <span className={styles.infoFieldValue}>{addr.postalCode}</span>
                    </div>
                    {addr.phone && (
                      <div className={styles.infoField}>
                        <span className={styles.infoFieldLabel}>Phone</span>
                        <span className={styles.infoFieldValue}>{addr.phone}</span>
                      </div>
                    )}
                  </div>
                  {typeof addr.latitude === 'number' && typeof addr.longitude === 'number' && (
                    <p className={styles.liveLocationAdded}>Live location added</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Active Subscriptions</h2>
          <div className={styles.subscriptionsList}>
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className={styles.subscriptionCard}>
                <h3 className={styles.subscriptionCardTitle}>{sub.product?.name || 'Product'}</h3>
                <p className={styles.subscriptionCardMeta}>Quantity: {sub.litresPerDay} x {sub.variationSize || '1L'}/day</p>
                <p className={styles.subscriptionCardMeta}>Delivery: {sub.deliveryTime}</p>
                <p className={styles.subscriptionCardMeta}>Next Delivery: {nextDeliveryShortLabelIST(sub)}</p>
                <p className={styles.subscriptionCardMeta}>Valid until: {new Date(sub.endDate).toLocaleDateString()}</p>
                <Link href={`/subscriptions/${sub.id}`} className={styles.subscriptionCardLink}>
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </CustomerSidebarLayout>
  );
}
