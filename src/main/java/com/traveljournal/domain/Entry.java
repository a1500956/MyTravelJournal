
package com.traveljournal.domain;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.ManyToOne;
import javax.persistence.Version;

import lombok.Data;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Data
@Entity
public class Entry {

	private @Id @GeneratedValue Long id;
	private String location;
	private String date;
	private String entry;

	private @Version @JsonIgnore Long version;

	private @ManyToOne Manager manager;

	

	public Entry() {
		super();
		// TODO Auto-generated constructor stub
	}

	
	
	public Entry(String location, String date, String entry, Manager manager) {
		super();
		
		this.location = location;
		this.date = date;
		this.entry = entry;
		this.manager = manager;
	}



	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	

	public String getLocation() {
		return location;
	}

	public void setLocation(String location) {
		this.location = location;
	}

	public String getDate() {
		return date;
	}

	public void setDate(String date) {
		this.date = date;
	}

	public String getEntry() {
		return entry;
	}

	public void setEntry(String entry) {
		this.entry = entry;
	}

	public Long getVersion() {
		return version;
	}

	public void setVersion(Long version) {
		this.version = version;
	}

	public Manager getManager() {
		return manager;
	}

	public void setManager(Manager manager) {
		this.manager = manager;
	}
	
	
}
