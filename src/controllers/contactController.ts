import { Request, Response } from 'express';
import { ContactService } from '../services/contactService';

const contactService = new ContactService();

export const identify = async (req: Request, res: Response): Promise<void> => {
  const { email: rawEmail, phoneNumber: rawPhoneNumber } = req.body;

  // Process and validate email
  const email = (typeof rawEmail === 'string' && rawEmail.trim() !== "") 
                ? rawEmail.trim() 
                : null;

  // Process and validate phoneNumber (digits only)
  const phoneNumber = (rawPhoneNumber !== null && typeof rawPhoneNumber !== 'undefined') 
                    ? (() => {
                        const trimmed = String(rawPhoneNumber).trim();
                        return (/^\d+$/).test(trimmed) ? trimmed : null;
                        })()
                    : null;

  // Check if both are effectively null or empty after processing
  if (!email && !phoneNumber) {
    res.status(400).json({ error: 'Either email or phoneNumber must be provided, and they cannot be empty or whitespace only. phoneNumber must be digit only' });
    return;
  }

  try {
    // Pass the processed (and potentially null) values to the service
    const result = await contactService.identifyContact({ 
      email: email, 
      phoneNumber: phoneNumber 
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in identify controller:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    res.status(500).json({ error: 'Internal Server Error', details: message });
  }
};
