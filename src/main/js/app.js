'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const when = require('when');
const client = require('./client');





const follow = require('./follow'); 

const stompClient = require('./websocket-listener');

const root = '/traveljournal/api';


class App extends React.Component {

	constructor(props) {
		super(props);
		this.state = {entries: [], attributes: [], page: 1, pageSize: 4, links: {}};
		this.updatePageSize = this.updatePageSize.bind(this);
		this.onCreate = this.onCreate.bind(this);
		this.onUpdate = this.onUpdate.bind(this);
		this.onDelete = this.onDelete.bind(this);
		this.onNavigate = this.onNavigate.bind(this);
		this.refreshCurrentPage = this.refreshCurrentPage.bind(this);
		this.refreshAndGoToLastPage = this.refreshAndGoToLastPage.bind(this);
	}

	loadFromServer(pageSize) {
		follow(client, root, [
				{rel: 'entries', params: {size: pageSize}}]
		).then(entryCollection => {
			return client({
				method: 'GET',
				path: entryCollection.entity._links.profile.href,
				headers: {'Accept': 'application/schema+json'}
			}).then(schema => {
		
				Object.keys(schema.entity.properties).forEach(function (property) {
					if (schema.entity.properties[property].hasOwnProperty('format') &&
						schema.entity.properties[property].format === 'uri') {
						delete schema.entity.properties[property];
					}
					else if (schema.entity.properties[property].hasOwnProperty('$ref')) {
						delete schema.entity.properties[property];
					}
				});

				this.schema = schema.entity;
				this.links = entryCollection.entity._links;
				return entryCollection;

			});
		}).then(entryCollection => {
			this.page = entryCollection.entity.page;
			return entryCollection.entity._embedded.entries.map(entry =>
					client({
						method: 'GET',
						path: entry._links.self.href
					})
			);
		}).then(entryPromises => {
			return when.all(entryPromises);
		}).done(entries => {
			this.setState({
				page: this.page,
				entries: entries,
				attributes: Object.keys(this.schema.properties),
				pageSize: pageSize,
				links: this.links
			});
		});
	}


	onCreate(newEntry) {
		follow(client, root, ['entries']).done(response => {
			client({
				method: 'POST',
				path: response.entity._links.self.href,
				entity: newEntry,
				headers: {'Content-Type': 'application/json'}
			})
		})
	}
	
	onUpdate(entry, updatedEntry) {
		client({
			method: 'PUT',
			path: entry.entity._links.self.href,
			entity: updatedEntry,
			headers: {
				'Content-Type': 'application/json',
				'If-Match': entry.headers.Etag
			}
		}).done(response => {

		}, response => {
			if (response.status.code === 403) {
				alert('ACCESS DENIED: You are not authorized to update ' +
					entry.entity._links.self.href);
			}
			if (response.status.code === 412) {
				alert('DENIED: Unable to update ' + entry.entity._links.self.href +
					'. Your copy is stale.');
			}
		});
	}

	onDelete(entry) {
		client({method: 'DELETE', path: entry.entity._links.self.href}
		).done(response => {/* let the websocket handle updating the UI */},
		response => {
			if (response.status.code === 403) {
				alert('ACCESS DENIED: You are not authorized to delete ' +
					entry.entity._links.self.href);
			}
		});
	}


	onNavigate(navUri) {
		client({
			method: 'GET',
			path: navUri
		}).then(entryCollection => {
			this.links = entryCollection.entity._links;
			this.page = entryCollection.entity.page;

			return entryCollection.entity._embedded.entries.map(entry =>
					client({
						method: 'GET',
						path: entry._links.self.href
					})
			);
		}).then(entryPromises => {
			return when.all(entryPromises);
		}).done(entries => {
			this.setState({
				page: this.page,
				entries: entries,
				attributes: Object.keys(this.schema.properties),
				pageSize: this.state.pageSize,
				links: this.links
			});
		});
	}

	updatePageSize(pageSize) {
		if (pageSize !== this.state.pageSize) {
			this.loadFromServer(pageSize);
		}
	}


	refreshAndGoToLastPage(message) {
		follow(client, root, [{
			rel: 'entries',
			params: {size: this.state.pageSize}
		}]).done(response => {
			if (response.entity._links.last !== undefined) {
				this.onNavigate(response.entity._links.last.href);
			} else {
				this.onNavigate(response.entity._links.self.href);
			}
		})
	}

	refreshCurrentPage(message) {
		follow(client, root, [{
			rel: 'entries',
			params: {
				size: this.state.pageSize,
				page: this.state.page.number
			}
		}]).then(entryCollection => {
			this.links = entryCollection.entity._links;
			this.page = entryCollection.entity.page;

			return entryCollection.entity._embedded.entries.map(entry => {
				return client({
					method: 'GET',
					path: entry._links.self.href
				})
			});
		}).then(entryPromises => {
			return when.all(entryPromises);
		}).then(entries => {
			this.setState({
				page: this.page,
				entries: entries,
				attributes: Object.keys(this.schema.properties),
				pageSize: this.state.pageSize,
				links: this.links
			});
		});
	}

	componentDidMount() {
		this.loadFromServer(this.state.pageSize);
		stompClient.register([
			{route: '/topic/newEntry', callback: this.refreshAndGoToLastPage},
			{route: '/topic/updateEntry', callback: this.refreshCurrentPage},
			{route: '/topic/deleteEntry', callback: this.refreshCurrentPage}
		]);
	}


	render() {
		return (
			<div>
				
				<EntryList page={this.state.page}
							  entries={this.state.entries}
							  links={this.state.links}
							  pageSize={this.state.pageSize}
							  attributes={this.state.attributes}
							  onNavigate={this.onNavigate}
							  onUpdate={this.onUpdate}
							  onDelete={this.onDelete}
							  updatePageSize={this.updatePageSize}/>
				
			</div>
				
		)
	}
}



class EntryList extends React.Component {

	constructor(props) {
		super(props);
		this.handleNavFirst = this.handleNavFirst.bind(this);
		this.handleNavPrev = this.handleNavPrev.bind(this);
		this.handleNavNext = this.handleNavNext.bind(this);
		this.handleNavLast = this.handleNavLast.bind(this);
		this.handleInput = this.handleInput.bind(this);
		this.handleDelete = this.handleDelete.bind(this);
	}

	handleDelete() {
		this.props.onDelete(this.props.entry);
}
	
	handleInput(e) {
		e.preventDefault();
		var pageSize = ReactDOM.findDOMNode(this.refs.pageSize).value;
		if (/^[0-9]+$/.test(pageSize)) {
			this.props.updatePageSize(pageSize);
		} else {
			ReactDOM.findDOMNode(this.refs.pageSize).value = pageSize.substring(0, pageSize.length - 1);
		}
	}

	handleNavFirst(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.first.href);
	}

	handleNavPrev(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.prev.href);
	}

	handleNavNext(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.next.href);
	}

	handleNavLast(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.last.href);
	}

	render() {
		var pageInfo = this.props.page.hasOwnProperty("number") ?
			<p>Page {this.props.page.number + 1} of {this.props.page.totalPages}</p> : null;

		var entries = this.props.entries.map(entry =>
			<Entry key={entry.entity._links.self.href}
					  entry={entry}
					  attributes={this.props.attributes}
					  onUpdate={this.props.onUpdate}
					  onDelete={this.props.onDelete}/>
		);

		var navLinks = [];
		if ("first" in this.props.links) {
			navLinks.push(<button className="btnNav" key="first" onClick={this.handleNavFirst}>&nbsp;&lt;&lt;</button>);
		}
		if ("prev" in this.props.links) {
			navLinks.push(<button className="btnNav" key="prev" onClick={this.handleNavPrev}>&nbsp;&lt;</button>);
		}
		if ("next" in this.props.links) {
			navLinks.push(<button className="btnNav" key="next" onClick={this.handleNavNext}>&nbsp;&gt;</button>);
		}
		if ("last" in this.props.links) {
			navLinks.push(<button className="btnNav" key="last" onClick={this.handleNavLast}>&nbsp;&gt;&gt;</button>);
		}

		return (
				<div>
				<h3 className="text-center">{pageInfo}</h3>
				<h3 className="text-center">{navLinks}</h3>
				{this.props.entries.map((entry, index) => (
				<div className="col-sm-6">
				<div className="thumbnail">
				<p className="teksti"><strong>Location: </strong>{entry.entity.location}</p><br/>
				<p className="teksti"><strong>Date: </strong>{entry.entity.date}</p><br/>
				<p>{entry.entity.entry}</p>
				</div>
				</div>
				))}
				<div>
				
			</div>
		</div>
		
		);
		
		}
	}

	class Entry extends React.Component {

		constructor(props) {
			super(props);
			this.handleDelete = this.handleDelete.bind(this);
		}

		handleDelete() {
			this.props.onDelete(this.props.entry);
		}

		render() {
			
			
			
			return (
				<tr>
					<td>{this.props.entry.entity.location}</td>
					<td>{this.props.entry.entity.date}</td>
					<td className="entry">{this.props.entry.entity.entry}</td>
					<td>
						<UpdateDialog entry={this.props.entry}
									  attributes={this.props.attributes}
									  onUpdate={this.props.onUpdate}/>
					</td>
					<td>						
						<button className="icon-button" onClick={this.handleDelete}><span className="glyphicon glyphicon-trash"></span></button>
					</td>
				</tr>
			)
		}
	}
	
	
	class AppCreate extends React.Component {

		constructor(props) {
		      super(props);
		      this.createEntry = this.createEntry.bind(this);
		      this.state = {
		          entries: [],
		      };
		   }
		 
		    
		  createEntry(entry) {
			  follow(client, root, ['entries']).done(response => {
					client({
						method: 'POST',
						path: response.entity._links.self.href,
						entity: entry,
						headers: {'Content-Type': 'application/json'}
					})
				})
			}
		  
		  render() {
		    return (
		       <div>
		          <EntryForm createEntry={this.createEntry}/>
		          
		       </div>
		    );
		  }
		}
		    	

		class EntryForm extends React.Component {
		    constructor(props) {
		        super(props);
		        this.state = {location: '', date: '', entry: ''};
		        this.handleSubmit = this.handleSubmit.bind(this);   
		        this.handleChange = this.handleChange.bind(this);     
		    }

		    handleChange(event) {
		        console.log("NAME: " + event.target.name + " VALUE: " + event.target.value)
		        this.setState(
		            {[event.target.name]: event.target.value}
		        );
		    }    
		    
		    handleSubmit(event) {
		        event.preventDefault();
		        console.log("Location: " + this.state.location);
		        var newEntry = {location: this.state.location, date: this.state.date, entry: this.state.entry};
		        this.props.createEntry(newEntry);
		        window.location = "#tour";
		}
		render() {
			
			return (
				<div>
				<br/>
				<br/>
				<h3 className="text-center">New Entry</h3>
				<br/>
				<br/>
				<div className="row">
				<div className="col-md-4">
				<p id="Mylocation" ><span className="glyphicon glyphicon-map-marker"></span></p>
			    </div>
				<div className="col-md-8">
				<form>
				<div className="row">
				<div className="col-sm-6 form-group">		
				<input className="form-control" id="location" name="location" placeholder="Location" type="text" onChange={this.handleChange}/>
				</div>
				<div className="col-sm-6 form-group">
		         <div className="input-group date" id="datetimepicker1">
		                    <input type="text" className="form-control" id="date" name="date" onChange={this.handleChange}/>
		                    <span className="input-group-addon"><span className="glyphicon glyphicon-calendar" ></span>
		                    </span>
		                </div>
		        </div>
		        </div>
		        <textarea className="form-control" type="text" id="entry" name="entry" placeholder="Entry" rows="5" onChange={this.handleChange}></textarea>
		        <br/>
		        <div className="row">
		        <div className="col-md-12 form-group">		
		        <button className="btn pull-right" id="submitBtn" onClick={this.handleSubmit}>Save</button>
				</div>	
				</div>
				
						</form>
					</div>
				</div>
				</div>
			);
		}
	}
		


		class AppEntryList3 extends React.Component {

			constructor(props) {
				super(props);
				this.state = {entries: [], attributes: [], page: 1, pageSize: 4, links: {}};
				this.updatePageSize = this.updatePageSize.bind(this);
				this.onCreate = this.onCreate.bind(this);
				this.onUpdate = this.onUpdate.bind(this);
				this.onDelete = this.onDelete.bind(this);
				this.onNavigate = this.onNavigate.bind(this);
				this.refreshCurrentPage = this.refreshCurrentPage.bind(this);
				this.refreshAndGoToLastPage = this.refreshAndGoToLastPage.bind(this);
			}

			loadFromServer(pageSize) {
				follow(client, root, [
						{rel: 'entries', params: {size: pageSize}}]
				).then(entryCollection => {
					return client({
						method: 'GET',
						path: entryCollection.entity._links.profile.href,
						headers: {'Accept': 'application/schema+json'}
					}).then(schema => {
				
						Object.keys(schema.entity.properties).forEach(function (property) {
							if (schema.entity.properties[property].hasOwnProperty('format') &&
								schema.entity.properties[property].format === 'uri') {
								delete schema.entity.properties[property];
							}
							else if (schema.entity.properties[property].hasOwnProperty('$ref')) {
								delete schema.entity.properties[property];
							}
						});

						this.schema = schema.entity;
						this.links = entryCollection.entity._links;
						return entryCollection;

					});
				}).then(entryCollection => {
					this.page = entryCollection.entity.page;
					return entryCollection.entity._embedded.entries.map(entry =>
							client({
								method: 'GET',
								path: entry._links.self.href
							})
					);
				}).then(entryPromises => {
					return when.all(entryPromises);
				}).done(entries => {
					this.setState({
						page: this.page,
						entries: entries,
						attributes: Object.keys(this.schema.properties),
						pageSize: pageSize,
						links: this.links
					});
				});
			}


			onCreate(newEntry) {
				follow(client, root, ['entries']).done(response => {
					client({
						method: 'POST',
						path: response.entity._links.self.href,
						entity: newEntry,
						headers: {'Content-Type': 'application/json'}
					})
				})
			}

			onUpdate(entry, updatedEntry) {
				client({
					method: 'PUT',
					path: entry.entity._links.self.href,
					entity: updatedEntry,
					headers: {
						'Content-Type': 'application/json',
						'If-Match': entry.headers.Etag
					}
				}).done(response => {

				}, response => {
					if (response.status.code === 403) {
						alert('ACCESS DENIED: You are not authorized to update ' +
							entry.entity._links.self.href);
					}
					if (response.status.code === 412) {
						alert('DENIED: Unable to update ' + entry.entity._links.self.href +
							'. Your copy is stale.');
					}
				});
			}

			onDelete(entry) {
				client({method: 'DELETE', path: entry.entity._links.self.href}
				).done(response => {/* let the websocket handle updating the UI */},
				response => {
					if (response.status.code === 403) {
						alert('ACCESS DENIED: You are not authorized to delete ' +
							entry.entity._links.self.href);
					}
				});
			}


			onNavigate(navUri) {
				client({
					method: 'GET',
					path: navUri
				}).then(entryCollection => {
					this.links = entryCollection.entity._links;
					this.page = entryCollection.entity.page;

					return entryCollection.entity._embedded.entries.map(entry =>
							client({
								method: 'GET',
								path: entry._links.self.href
							})
					);
				}).then(entryPromises => {
					return when.all(entryPromises);
				}).done(entries => {
					this.setState({
						page: this.page,
						entries: entries,
						attributes: Object.keys(this.schema.properties),
						pageSize: this.state.pageSize,
						links: this.links
					});
				});
			}

			updatePageSize(pageSize) {
				if (pageSize !== this.state.pageSize) {
					this.loadFromServer(pageSize);
				}
			}


			refreshAndGoToLastPage(message) {
				follow(client, root, [{
					rel: 'entries',
					params: {size: this.state.pageSize}
				}]).done(response => {
					if (response.entity._links.last !== undefined) {
						this.onNavigate(response.entity._links.last.href);
					} else {
						this.onNavigate(response.entity._links.self.href);
					}
				})
			}

			refreshCurrentPage(message) {
				follow(client, root, [{
					rel: 'entries',
					params: {
						size: this.state.pageSize,
						page: this.state.page.number
					}
				}]).then(entryCollection => {
					this.links = entryCollection.entity._links;
					this.page = entryCollection.entity.page;

					return entryCollection.entity._embedded.entries.map(entry => {
						return client({
							method: 'GET',
							path: entry._links.self.href
						})
					});
				}).then(entryPromises => {
					return when.all(entryPromises);
				}).then(entries => {
					this.setState({
						page: this.page,
						entries: entries,
						attributes: Object.keys(this.schema.properties),
						pageSize: this.state.pageSize,
						links: this.links
					});
				});
			}

			componentDidMount() {
				this.loadFromServer(this.state.pageSize);
				stompClient.register([
					{route: '/topic/newEntry', callback: this.refreshAndGoToLastPage},
					{route: '/topic/updateEntry', callback: this.refreshCurrentPage},
					{route: '/topic/deleteEntry', callback: this.refreshCurrentPage}
				]);
			}


			render() {
				return (
					<div>
						
						<EntryList2 page={this.state.page}
						  entries={this.state.entries}
						  links={this.state.links}
						  pageSize={this.state.pageSize}
						  attributes={this.state.attributes}
						  onNavigate={this.onNavigate}
						  onUpdate={this.onUpdate}
						  onDelete={this.onDelete}
						  updatePageSize={this.updatePageSize}/>
						
					</div>
				)
			}
		}
	

		class UpdateDialog extends React.Component {

			constructor(props) {
				super(props);
				this.handleSubmit = this.handleSubmit.bind(this);
			}

			handleSubmit(e) {
				e.preventDefault();
				var updatedEntry = {};
				this.props.attributes.forEach(attribute => {
					updatedEntry[attribute] = ReactDOM.findDOMNode(this.refs[attribute]).value.trim();
				});
				this.props.onUpdate(this.props.entry, updatedEntry);
				window.location = "#EntryList2";
			}

			render() {
				var inputs = this.props.attributes.map(attribute =>
						<p key={this.props.entry.entity[attribute]}>
							<input type="text" placeholder={attribute}
								   defaultValue={this.props.entry.entity[attribute]}
								   ref={attribute} className="form-control" />
						</p>
				);

				var dialogId = "updateEntry-" + this.props.entry.entity._links.self.href;

				return (
					<div>
						<a href={"#" + dialogId}>Edit</a>
						
						<div id={dialogId} className="modalDialog">
						<div className="modal-dialog">
						<div className="modal-content">
				        	<div className="modal-header">
								
								<a href="#" type="button" className="close">×</a>
								<h4><span className="glyphicon glyphicon-pencil"></span> Edit an entry</h4>
								</div>
								<form>
								<div className="modal-body">
								<div className="form-group">
									{inputs}
									</div>
									</div>
									<div className="modal-footer">
									<button className="btn" onClick={this.handleSubmit}>Update</button>
									</div>
								</form>
							</div>
						</div>
					</div>
					</div>
					
				)
			}

		}

			
				class EntryList2 extends React.Component {

					constructor(props) {
						super(props);
						this.handleNavFirst = this.handleNavFirst.bind(this);
						this.handleNavPrev = this.handleNavPrev.bind(this);
						this.handleNavNext = this.handleNavNext.bind(this);
						this.handleNavLast = this.handleNavLast.bind(this);
						this.handleInput = this.handleInput.bind(this);
					}

					handleInput(e) {
						e.preventDefault();
						var pageSize = ReactDOM.findDOMNode(this.refs.pageSize).value;
						if (/^[0-9]+$/.test(pageSize)) {
							this.props.updatePageSize(pageSize);
						} else {
							ReactDOM.findDOMNode(this.refs.pageSize).value = pageSize.substring(0, pageSize.length - 1);
						}
					}

					handleNavFirst(e) {
						e.preventDefault();
						this.props.onNavigate(this.props.links.first.href);
					}

					handleNavPrev(e) {
						e.preventDefault();
						this.props.onNavigate(this.props.links.prev.href);
					}

					handleNavNext(e) {
						e.preventDefault();
						this.props.onNavigate(this.props.links.next.href);
					}

					handleNavLast(e) {
						e.preventDefault();
						this.props.onNavigate(this.props.links.last.href);
					}

					render() {
						var pageInfo = this.props.page.hasOwnProperty("number") ?
							<p>Page {this.props.page.number + 1} of {this.props.page.totalPages}</p> : null;

						var entries = this.props.entries.map(entry =>
							<Entry key={entry.entity._links.self.href}
									entry={entry}
									  attributes={this.props.attributes}
									  onUpdate={this.props.onUpdate}
									  onDelete={this.props.onDelete}/>
						);

						var navLinks = [];
						if ("first" in this.props.links) {
							navLinks.push(<button key="first" onClick={this.handleNavFirst}>&lt;&lt;</button>);
						}
						if ("prev" in this.props.links) {
							navLinks.push(<button key="prev" onClick={this.handleNavPrev}>&lt;</button>);
						}
						if ("next" in this.props.links) {
							navLinks.push(<button key="next" onClick={this.handleNavNext}>&gt;</button>);
						}
						if ("last" in this.props.links) {
							navLinks.push(<button key="last" onClick={this.handleNavLast}>&gt;&gt;</button>);
						}

						return (
							<div>							
							<div className="panel-group">
							  <div className="panel panel-default">
							    <div className="panel-heading">
							      <h3 className="panel-title">
							        <a data-toggle="collapse" href="#collapse1">Edit Entries</a>
							      </h3>
							    </div>
							    <div id="collapse1" className="collapse">
							    <h3 className="text-center">{pageInfo}</h3>
								<table>
									<tbody>
										<tr>
											<th>Location</th>
											<th className="textRight">Date</th>
											<th className="textRight">Entry</th>
											<th></th>
											<th></th>
										</tr>
										{entries}
									</tbody>
								</table>
								<div>
								<h3 className="text-center">{navLinks}</h3>
								</div>
								<div className="panel-footer"></div>
							    </div>
							  </div>
							</div>
							</div>							
						)
					}
				}	
	
	ReactDOM.render(
		<App />,
		document.getElementById('react')
	)
	
	ReactDOM.render(
		<AppCreate />,
		document.getElementById('create')
	)
	
	ReactDOM.render(
		<AppEntryList3 />,
		document.getElementById('EntryList2')
	)